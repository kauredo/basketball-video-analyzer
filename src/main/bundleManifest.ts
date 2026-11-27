import { BUNDLE_IMAGE_EXTENSIONS, BUNDLE_VIDEO_EXTENSIONS, hasBundleExtension, isSafeBundleName } from "./bundleNames.ts";

export const BUNDLE_VERSION = 1;
export const VIDEOS_DIR = "videos";
export const CLIPS_DIR = "clips";

export interface Fingerprint {
  size: number;
  /** SHA-256 hex of the first FINGERPRINT_BYTES. */
  head: string;
  /** SHA-256 hex of the last FINGERPRINT_BYTES. */
  tail: string;
}

/** The "bundle" block of a .bvap file. Every path is relative to the folder the .bvap sits in. */
export interface BundleManifest {
  version: number;
  videos: Record<string, string>;
  clips: Record<string, { clip: string; thumbnail: string | null }>;
  fingerprints: Record<string, Fingerprint>;
}

export interface ManifestInput {
  recordings: Array<{ uid: string; videoFile: string | null; fingerprint: Fingerprint | null }>;
  clips: Array<{ uid: string; clipFile: string; thumbnailFile: string | null }>;
}

const invalid = () => new Error("INVALID_SESSION_FILE");

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * True for `<dir>/<name>` and nothing else: one forward slash, a name that
 * passes isSafeBundleName (so no `..`, drive letter, stream or backslash) and
 * ends in one of `extensions`. It can never leave the bundle.
 */
export const isBundlePath = (value: unknown, dir: string, extensions: readonly string[]): value is string => {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith(`${dir}/`)) return false;
  const name = value.slice(dir.length + 1);
  return isSafeBundleName(name) && hasBundleExtension(name, extensions);
};

const bundlePath = (dir: string, name: string, extensions: readonly string[]): string => {
  const joined = `${dir}/${name}`;
  if (!isBundlePath(joined, dir, extensions)) throw new Error(`Unsafe bundle name: ${name}`);
  return joined;
};

export const buildManifest = (input: ManifestInput): BundleManifest => {
  const manifest: BundleManifest = { version: BUNDLE_VERSION, videos: {}, clips: {}, fingerprints: {} };
  for (const recording of input.recordings) {
    if (recording.videoFile !== null) {
      manifest.videos[recording.uid] = bundlePath(VIDEOS_DIR, recording.videoFile, BUNDLE_VIDEO_EXTENSIONS);
    }
    if (recording.fingerprint !== null) manifest.fingerprints[recording.uid] = recording.fingerprint;
  }
  for (const clip of input.clips) {
    manifest.clips[clip.uid] = {
      clip: bundlePath(CLIPS_DIR, clip.clipFile, BUNDLE_VIDEO_EXTENSIONS),
      thumbnail: clip.thumbnailFile === null
        ? null
        : bundlePath(CLIPS_DIR, clip.thumbnailFile, BUNDLE_IMAGE_EXTENSIONS),
    };
  }
  return manifest;
};

const SHA256 = /^[0-9a-f]{64}$/;

const validFingerprint = (value: unknown): value is Fingerprint =>
  record(value) && Number.isSafeInteger(value.size) && (value.size as number) >= 0 &&
  typeof value.head === "string" && SHA256.test(value.head) &&
  typeof value.tail === "string" && SHA256.test(value.tail);

/**
 * Reads a bundle block. Keys must be uids of the session's own recordings and
 * clips (lowercase, as parseSession leaves them). Throws INVALID_SESSION_FILE
 * on anything else.
 */
export const parseManifest = (
  value: unknown,
  uids: { recordings: ReadonlySet<string>; clips: ReadonlySet<string> },
): BundleManifest => {
  if (!record(value) || value.version !== BUNDLE_VERSION ||
      !record(value.videos) || !record(value.clips) || !record(value.fingerprints)) throw invalid();

  const entries = (block: Record<string, unknown>, known: ReadonlySet<string>) =>
    Object.entries(block).map(([uid, entry]): [string, unknown] => {
      const lower = uid.toLowerCase();
      if (!known.has(lower)) throw invalid();
      return [lower, entry];
    });

  const manifest: BundleManifest = { version: BUNDLE_VERSION, videos: {}, clips: {}, fingerprints: {} };
  for (const [uid, file] of entries(value.videos, uids.recordings)) {
    if (!isBundlePath(file, VIDEOS_DIR, BUNDLE_VIDEO_EXTENSIONS)) throw invalid();
    manifest.videos[uid] = file;
  }
  for (const [uid, entry] of entries(value.clips, uids.clips)) {
    if (!record(entry) || !isBundlePath(entry.clip, CLIPS_DIR, BUNDLE_VIDEO_EXTENSIONS) ||
        !(entry.thumbnail === null || isBundlePath(entry.thumbnail, CLIPS_DIR, BUNDLE_IMAGE_EXTENSIONS))) throw invalid();
    manifest.clips[uid] = { clip: entry.clip, thumbnail: entry.thumbnail };
  }
  for (const [uid, fingerprint] of entries(value.fingerprints, uids.recordings)) {
    if (!validFingerprint(fingerprint)) throw invalid();
    manifest.fingerprints[uid] = { size: fingerprint.size, head: fingerprint.head, tail: fingerprint.tail };
  }
  return manifest;
};
