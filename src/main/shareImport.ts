import fs from "fs";
import path from "path";
import {
  BUNDLE_NO_FINGERPRINT, MAX_BUNDLE_CLIP_BYTES, MAX_BUNDLE_THUMBNAIL_BYTES, MAX_BUNDLE_VIDEO_BYTES,
  copyBundleFile, readBundleText, resolveBundleFile, type BundleCopy, type BundleFile,
} from "./bundleFiles.ts";
import { parseManifest, type BundleManifest, type Fingerprint } from "./bundleManifest.ts";
import { uniqueName } from "./bundleNames.ts";
import type { UidTable } from "./permanentIds.ts";
import { MAX_SESSION_BYTES, parseSessionData, prepareImport, type ParsedSession } from "./sessionData.ts";
import { SHARE_CANCELLED, copyErrorCode, copyFiles, type CopyState, type ShareProgress } from "./shareBundle.ts";

export const IMPORT_CANCELLED = "ERROR_IMPORT_CANCELLED";
export const IMPORT_FAILED = "ERROR_IMPORT_FAILED";
/** Another share or import is running. Both take the same lock. */
export const SHARE_BUSY = "ERROR_SHARE_BUSY";
export const INVALID_INPUT = "ERROR_INVALID_INPUT";

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const invalid = () => new Error("INVALID_SESSION_FILE");

/**
 * The local project a v4 .bvap comes back to, or null to import it as new.
 * A .json file and v1 to v3 always import as new.
 */
export const alreadyHave = (
  file: { bvap: boolean; version: number; projectUid: string | null },
  projectIdByUid: (uid: string) => number | null,
): number | null =>
  file.bvap && file.version === 4 && file.projectUid ? projectIdByUid(file.projectUid) : null;

/** `name`, or `name (shared)` when a local project already has that name. */
export const sharedProjectName = (name: string, isTaken: (name: string) => boolean, suffix: string): string =>
  isTaken(name) ? uniqueName(`${name} ${suffix}`, isTaken) : name;

/**
 * The 'received' snapshot of a .bvap with a share id: the session as it came,
 * without its share and bundle blocks, as the sender stored it.
 */
export const receivedSnapshot = (raw: unknown): { id: string; data: string } | null => {
  if (!record(raw) || !record(raw.share) || typeof raw.share.id !== "string" || !UID.test(raw.share.id)) return null;
  const { share, bundle, ...session } = raw;
  return { id: (share as { id: string }).id.toLowerCase(), data: JSON.stringify(session) };
};

export interface SharedFile {
  bvap: boolean;
  /** Real path of the folder the file sits in. */
  root: string;
  parsed: ParsedSession;
  /** Only a v4 .bvap's bundle and share blocks are read; anything else has neither. */
  manifest: BundleManifest | null;
  snapshot: { id: string; data: string } | null;
}

/**
 * Reads a .bvap or an old .json session once. The folder is resolved first,
 * so a .bvap reached through a symlinked folder opens; what is inside it is
 * still checked by resolveBundleFile.
 */
export const readSharedFile = async (file: string): Promise<SharedFile> => {
  const bvap = path.extname(file).toLowerCase() === ".bvap";
  const root = await fs.promises.realpath(path.dirname(file));
  let json: string;
  if (bvap) {
    json = await readBundleText(root, path.basename(file), MAX_SESSION_BYTES);
  } else {
    const real = path.join(root, path.basename(file));
    if ((await fs.promises.stat(real)).size > MAX_SESSION_BYTES) throw invalid();
    json = await fs.promises.readFile(real, "utf-8");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw invalid();
  }
  const parsed = parseSessionData(raw);
  if (!bvap || parsed.version !== 4) return { bvap, root, parsed, manifest: null, snapshot: null };

  const data = raw as Record<string, unknown>;
  const manifest = data.bundle === undefined ? null : parseManifest(data.bundle, {
    recordings: new Set(parsed.recordings.map(video => video.uid as string)),
    clips: new Set(parsed.clips.map(clip => clip.uid as string)),
  });
  return { bvap, root, parsed, manifest, snapshot: receivedSnapshot(data) };
};

export type RecordingSource =
  | { kind: "bundle"; file: BundleFile }
  | { kind: "local"; path: string }
  | { kind: "pick" };

export interface RecordingLookups {
  /** The bundle's copy of this recording, or null when the bundle has none. */
  bundleFile: (index: number) => Promise<BundleFile | null>;
  fingerprint: (index: number) => Fingerprint | null;
  /** A local recording with this fingerprint that is not in `taken`. */
  localMatch: (fingerprint: Fingerprint, taken: string[]) => Promise<string | null>;
}

/** Where each recording comes from: the bundle, a local file with its fingerprint, or else the file picker. */
export const resolveRecordings = async (count: number, lookups: RecordingLookups): Promise<RecordingSource[]> => {
  const sources: RecordingSource[] = [];
  const taken: string[] = [];
  for (let index = 0; index < count; index++) {
    const file = await lookups.bundleFile(index);
    if (file) {
      sources.push({ kind: "bundle", file });
      continue;
    }
    const fingerprint = lookups.fingerprint(index);
    const local = fingerprint ? await lookups.localMatch(fingerprint, taken) : null;
    if (local) {
      taken.push(local);
      sources.push({ kind: "local", path: local });
    } else {
      sources.push({ kind: "pick" });
    }
  }
  return sources;
};

/** The first candidate with the same fingerprint. Only files of the same size get read. */
export const findLocalMatch = async (
  fingerprint: Fingerprint,
  candidates: string[],
  sizeOf: (file: string) => Promise<number | null>,
  fingerprintOf: (file: string) => Promise<Fingerprint | null>,
): Promise<string | null> => {
  for (const file of candidates) {
    if (await sizeOf(file) !== fingerprint.size) continue;
    const local = await fingerprintOf(file);
    if (local?.size === fingerprint.size && local.head === fingerprint.head && local.tail === fingerprint.tail) {
      return file;
    }
  }
  return null;
};

export interface BundledClip {
  clip: BundleFile;
  thumbnail: BundleFile | null;
}

/** One per session recording: a bundled file, or a local path (matched or picked). */
export type ImportRecording = { path: string; bundle: BundleFile | null };

export interface ContentLookups {
  /** Every recording path in this computer's projects. */
  localPaths: () => string[];
  sizeOf: (file: string) => Promise<number | null>;
  fingerprintOf: (file: string) => Promise<Fingerprint | null>;
  /** Asks the coach for one recording; null when they cancel. No file in `taken` may be picked. */
  pick: (name: string, index: number, count: number, taken: string[]) => Promise<string | null>;
  isSamePath: (a: string, b: string) => boolean;
  /** For tests: resolveBundleFile otherwise. */
  resolve?: typeof resolveBundleFile;
}

/**
 * Finds every recording and clip file a shared project needs. Bundle files are
 * resolved before the coach is asked for anything, so a refused bundle never
 * costs a file dialog. Null when the coach cancels a picker.
 */
export const resolveBundleContents = async (
  { root, parsed, manifest }: Pick<SharedFile, "root" | "parsed" | "manifest">,
  lookups: ContentLookups,
): Promise<{ recordings: ImportRecording[]; clips: Array<BundledClip | null> } | null> => {
  const resolve = lookups.resolve ?? resolveBundleFile;
  const fingerprint = (index: number) => {
    const uid = parsed.recordings[index].uid;
    return (uid && manifest?.fingerprints[uid]) || null;
  };
  const localFingerprints = new Map<string, Promise<Fingerprint | null>>();
  const cachedFingerprint = (file: string) => {
    if (!localFingerprints.has(file)) localFingerprints.set(file, lookups.fingerprintOf(file).catch(() => null));
    return localFingerprints.get(file)!;
  };

  const sources = await resolveRecordings(parsed.recordings.length, {
    bundleFile: async index => {
      const uid = parsed.recordings[index].uid;
      const rel = uid ? manifest?.videos[uid] : undefined;
      if (!rel) return null;
      const expected = fingerprint(index);
      if (!expected) throw new Error(`${BUNDLE_NO_FINGERPRINT} ${rel}`);
      return resolve(root, rel, { maxBytes: MAX_BUNDLE_VIDEO_BYTES, expectSize: expected.size, media: true });
    },
    fingerprint,
    localMatch: (expected, taken) => findLocalMatch(
      expected,
      lookups.localPaths().filter(local => !taken.some(other => lookups.isSamePath(other, local))),
      lookups.sizeOf,
      cachedFingerprint,
    ),
  });

  const clips: Array<BundledClip | null> = [];
  for (const clip of parsed.clips) {
    const entry = clip.uid ? manifest?.clips[clip.uid] : undefined;
    if (!entry) {
      clips.push(null);
      continue;
    }
    clips.push({
      clip: await resolve(root, entry.clip, { maxBytes: MAX_BUNDLE_CLIP_BYTES, media: true }),
      thumbnail: entry.thumbnail
        ? await resolve(root, entry.thumbnail, { maxBytes: MAX_BUNDLE_THUMBNAIL_BYTES, media: true })
        : null,
    });
  }

  const known = sources.map(source =>
    source.kind === "bundle" ? source.file.path : source.kind === "local" ? source.path : null);
  const recordings: ImportRecording[] = [];
  for (const [index, source] of sources.entries()) {
    if (source.kind === "bundle") {
      recordings.push({ path: source.file.path, bundle: source.file });
      continue;
    }
    if (source.kind === "local") {
      recordings.push({ path: source.path, bundle: null });
      continue;
    }
    // Every other recording's file, so one file never becomes two recordings.
    const taken = [
      ...recordings.map(recording => recording.path),
      ...known.slice(index + 1).filter((file): file is string => file !== null),
    ];
    const chosen = await lookups.pick(parsed.recordings[index].videoName, index, sources.length, taken);
    if (!chosen) return null;
    recordings.push({ path: chosen, bundle: null });
  }
  return { recordings, clips };
};

/** A shared project read and checked, waiting for the coach. Layer 6 adds `{ kind: "merge" }`. */
export type PendingShare = {
  kind: "new";
  session: ParsedSession;
  recordings: ImportRecording[];
  clips: Array<BundledClip | null>;
  snapshot: { id: string; data: string } | null;
};

/**
 * The new-project import for a shared file: uids from prepareImport, the
 * " (shared)" name, and a snapshot only when the uids were kept (a fresh-uid
 * copy cannot match the sender's rows).
 */
export const prepareNewImport = (
  shared: Pick<SharedFile, "parsed" | "snapshot">,
  contents: { recordings: ImportRecording[]; clips: Array<BundledClip | null> },
  options: {
    uidExists: (table: UidTable, uids: string[]) => boolean;
    nameTaken: (name: string) => boolean;
    suffix: string;
    newUid: () => string;
  },
): PendingShare => {
  const prepared = prepareImport(shared.parsed, options.uidExists);
  return {
    kind: "new",
    session: {
      ...prepared,
      project: {
        ...prepared.project,
        // The copied videos' folder is named after it, so a fresh copy gets one now.
        uid: prepared.project.uid ?? options.newUid(),
        name: sharedProjectName(prepared.project.name, options.nameTaken, options.suffix),
      },
    },
    ...contents,
    snapshot: prepared.project.uid !== null ? shared.snapshot : null,
  };
};

/**
 * The one share or import that may run at a time, and the import waiting
 * for the coach's choice. A pending import is kept until an import of it
 * succeeds or is cancelled, so a failed one (no space, say) can be retried.
 */
export class ShareOperations<Pending> {
  private pending: Pending | null = null;
  private active: AbortController | null = null;
  private settled: Promise<void> = Promise.resolve();

  get waiting(): Pending | null {
    return this.pending;
  }

  get running(): boolean {
    return this.active !== null;
  }

  async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.active) throw new Error(SHARE_BUSY);
    const controller = new AbortController();
    this.active = controller;
    const running = work(controller.signal);
    this.settled = running.then(() => {}, () => {});
    try {
      return await running;
    } finally {
      if (this.active === controller) this.active = null;
    }
  }

  /** Settles once the running operation, its cleanup included, has finished. */
  idle(): Promise<void> {
    return this.settled;
  }

  /** Keeps an import for the coach's choice, replacing any earlier one. */
  hold(pending: Pending): void {
    this.pending = pending;
  }

  async finish<T>(work: (pending: Pending, signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.active) throw new Error(SHARE_BUSY);
    const pending = this.pending;
    if (!pending) throw new Error(INVALID_INPUT);
    return this.run(async signal => {
      try {
        const result = await work(pending, signal);
        if (this.pending === pending) this.pending = null;
        return result;
      } catch (error) {
        if (signal.aborted && this.pending === pending) this.pending = null;
        throw error;
      }
    });
  }

  /** Drops the waiting import, unless something is running. */
  discard(): void {
    if (!this.active) this.pending = null;
  }

  cancel(): boolean {
    if (!this.active) return false;
    this.active.abort();
    return true;
  }
}

export interface ImportPlanInput {
  recordings: ImportRecording[];
  /** One per session clip; null for a clip the bundle has no file for. */
  clips: Array<BundledClip | null>;
  /** Bundled recordings are copied when set, used where they are otherwise. */
  copyVideos: boolean;
  videosDir: string;
  clipsDir: string;
  exists: (file: string) => boolean;
  /** A fresh name for each clip file. */
  newName: () => string;
}

const lowerExtension = (name: string): string => {
  const extension = path.extname(name);
  return `${name.slice(0, name.length - extension.length)}${extension.toLowerCase()}`;
};

/**
 * What an import copies, where each recording ends up, and each clip's files.
 * Never plans over a file that exists, ignoring case, and lowercases extensions.
 */
export const planImportCopies = (input: ImportPlanInput) => {
  const copies: BundleCopy[] = [];
  const planned = new Set<string>();
  const copyTo = (source: BundleFile, dir: string, name: string): string => {
    const unique = uniqueName(lowerExtension(name), candidate => {
      const target = path.join(dir, candidate);
      return planned.has(target.toLowerCase()) || input.exists(target);
    }, true);
    const target = path.join(dir, unique);
    planned.add(target.toLowerCase());
    copies.push({ source: source.path, target, size: source.size, name: source.rel, media: true });
    return target;
  };

  const paths = input.recordings.map(recording =>
    recording.bundle && input.copyVideos
      ? copyTo(recording.bundle, input.videosDir, path.basename(recording.bundle.path))
      : recording.path);

  const clipFiles = input.clips.map(bundled => {
    if (!bundled) return null;
    const name = input.newName();
    return {
      output: copyTo(bundled.clip, input.clipsDir, `${name}${path.extname(bundled.clip.path)}`),
      thumbnail: bundled.thumbnail
        ? copyTo(bundled.thumbnail, input.clipsDir, `${name}-thumb${path.extname(bundled.thumbnail.path)}`)
        : "",
    };
  });

  return { copies, paths, clipFiles, totalBytes: copies.reduce((total, copy) => total + copy.size, 0) };
};

const removeImported = async (files: string[], dirs: string[]): Promise<void> => {
  for (const file of files) {
    try {
      await fs.promises.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      console.error("Error removing a file from a failed import:", error);
    }
  }
  // Deepest first, and only folders this import created; one that still has files stays.
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
    await fs.promises.rmdir(dir).catch(() => {});
  }
};

export interface RunImportInput<T> {
  copies: BundleCopy[];
  /** Writes the rows, in one transaction. Runs once every copy is done. */
  write: () => T;
  signal: AbortSignal;
  onProgress: (progress: ShareProgress) => void;
  /** For tests; copyBundleFile otherwise. */
  copyOne?: (copy: BundleCopy, signal: AbortSignal, onBytes: (bytes: number) => void) => Promise<void>;
}

/**
 * Copies the files, then writes the rows. When a copy fails, the import is
 * cancelled or the write throws, every file this import copied is removed,
 * with any folder it created for them.
 */
export const runImport = async <T>(input: RunImportInput<T>): Promise<T> => {
  const { copies, signal } = input;
  const state: CopyState = { current: null, written: [] };
  const createdDirs: string[] = [];
  let copying = true;
  try {
    for (const dir of new Set(copies.map(copy => path.dirname(copy.target)))) {
      const first = await fs.promises.mkdir(dir, { recursive: true });
      for (let made = dir; first; made = path.dirname(made)) {
        createdDirs.push(made);
        if (made === first || path.dirname(made) === made) break;
      }
    }
    await copyFiles(copies, signal, input.onProgress, state, input.copyOne ?? copyBundleFile);
    if (signal.aborted) throw new Error(SHARE_CANCELLED);
    copying = false;
    return input.write();
  } catch (error) {
    await removeImported(state.written, createdDirs);
    if (signal.aborted) throw new Error(IMPORT_CANCELLED);
    console.error("Error importing a shared project:", error);
    const message = error instanceof Error ? error.message : "";
    if (copying && !message.startsWith("ERROR_BUNDLE_")) throw new Error(copyErrorCode(error, state));
    throw error;
  }
};
