import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { CLIPS_DIR, VIDEOS_DIR } from "./bundleManifest.ts";
import { isSafeBundleName } from "./bundleNames.ts";
import { isInsideDir } from "./insideDir.ts";

/** A symlink, a hard link, something other than a file, a path that leaves the folder, wrong magic bytes or over its cap. */
export const BUNDLE_FILE_UNSAFE = "ERROR_BUNDLE_FILE_UNSAFE";
/** A file whose size is not the one the share recorded for it. */
export const BUNDLE_FILE_CHANGED = "ERROR_BUNDLE_FILE_CHANGED";
/** The share lists a file the folder does not have. */
export const BUNDLE_INCOMPLETE = "ERROR_BUNDLE_INCOMPLETE";
/** The share lists a video without the fingerprint that says what size it must be. */
export const BUNDLE_NO_FINGERPRINT = "ERROR_BUNDLE_NO_FINGERPRINT";

export const MAX_BUNDLE_VIDEO_BYTES = 200 * 1024 ** 3;
export const MAX_BUNDLE_CLIP_BYTES = 20 * 1024 ** 3;
export const MAX_BUNDLE_THUMBNAIL_BYTES = 20 * 1024 ** 2;

const COPY_CHUNK = 1024 * 1024;
const SIGNATURE_BYTES = 12;

export interface BundleFile {
  /** Real path, inside the bundle folder. */
  path: string;
  size: number;
  /** Its path in the bundle (`videos/game.mp4`), for messages. */
  rel: string;
  /** Device and inode when checked, as strings because Windows file ids pass 2^53. */
  dev: string;
  ino: string;
}

const unsafe = (rel: string) => new Error(`${BUNDLE_FILE_UNSAFE} ${rel}`);

/**
 * True when `head`, a file's first bytes, starts the way a file with this
 * extension does. Unknown extensions are false.
 */
export const hasMediaSignature = (head: Buffer, extension: string): boolean => {
  const ascii = (start: number, text: string) =>
    head.length >= start + text.length && head.subarray(start, start + text.length).toString("latin1") === text;
  const bytes = (list: number[]) => head.length >= list.length && list.every((byte, index) => head[index] === byte);
  switch (extension.toLowerCase()) {
    case ".mp4":
    case ".mov":
    case ".m4v":
      // Older QuickTime files open with a moov, wide, mdat, free or skip atom instead of ftyp.
      return ["ftyp", "moov", "wide", "mdat", "free", "skip"].some((box) => ascii(4, box));
    case ".mkv":
    case ".webm":
      return bytes([0x1a, 0x45, 0xdf, 0xa3]);
    case ".avi":
      return ascii(0, "RIFF") && ascii(8, "AVI ");
    case ".wmv":
      return bytes([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]);
    case ".flv":
      return ascii(0, "FLV");
    case ".jpg":
    case ".jpeg":
      return bytes([0xff, 0xd8, 0xff]);
    case ".png":
      return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    default:
      return false;
  }
};

/**
 * Opens a file to read without following a symlink in its last step, and
 * without blocking on a FIFO. Windows has no O_NOFOLLOW, so there an lstat
 * runs right before the open.
 */
export const openNoFollow = async (
  file: string, noFollow: number | null = fs.constants.O_NOFOLLOW ?? null,
): Promise<fs.promises.FileHandle> => {
  const nonBlock = fs.constants.O_NONBLOCK ?? 0;
  if (noFollow === null) {
    if ((await fs.promises.lstat(file)).isSymbolicLink()) {
      throw Object.assign(new Error("symlink"), { code: "ELOOP" });
    }
    return fs.promises.open(file, fs.constants.O_RDONLY | nonBlock);
  }
  return fs.promises.open(file, fs.constants.O_RDONLY | noFollow | nonBlock);
};

interface Expect {
  maxBytes: number;
  expectSize?: number;
  /** Check the magic bytes for the file's extension. */
  media?: boolean;
}

/** Checks an open file: a plain file with one link, within its size rules, with the right magic bytes. */
const inspect = async (handle: fs.promises.FileHandle, rel: string, extension: string, expect: Expect) => {
  const stats = await handle.stat();
  if (!stats.isFile() || stats.nlink !== 1 || stats.size > expect.maxBytes) throw unsafe(rel);
  if (expect.expectSize !== undefined && stats.size !== expect.expectSize) {
    throw new Error(`${BUNDLE_FILE_CHANGED} ${rel}`);
  }
  if (expect.media) {
    const head = Buffer.alloc(SIGNATURE_BYTES);
    const { bytesRead } = await handle.read(head, 0, SIGNATURE_BYTES, 0);
    if (!hasMediaSignature(head.subarray(0, bytesRead), extension)) throw unsafe(rel);
  }
  return stats;
};

/** Opens `file` with openNoFollow, turning a symlink into BUNDLE_FILE_UNSAFE and a missing file into BUNDLE_INCOMPLETE. */
const openBundleFile = async (file: string, rel: string, noFollow?: number | null) => {
  try {
    return await openNoFollow(file, noFollow);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`${BUNDLE_INCOMPLETE} ${rel}`);
    if (code === "ELOOP" || code === "EMLINK") throw unsafe(rel);
    throw error;
  }
};

const lstatIfThere = async (file: string): Promise<fs.Stats | null> => {
  try {
    return await fs.promises.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

/**
 * The one way to reach a file in a received bundle, whose sender is not
 * trusted. `root` is the real path of the folder the .bvap sits in; `rel` is
 * `<name>` or `videos/<name>` / `clips/<name>`. The root, the folder and the
 * file are each lstat'd: no symlinks, the folders must be folders and the
 * file a plain file with one link, and its real path must stay inside the
 * root. Throws BUNDLE_INCOMPLETE when it is not there, BUNDLE_FILE_UNSAFE or
 * BUNDLE_FILE_CHANGED before anything but the magic bytes is read.
 */
export const resolveBundleFile = (
  root: string, rel: string, expect: Expect, noFollow?: number | null,
): Promise<BundleFile> =>
  withBundleFile(root, rel, expect, noFollow, async (real, stats, handle) => {
    const { dev, ino } = await handle.stat({ bigint: true });
    return { path: real, size: stats.size, rel, dev: String(dev), ino: String(ino) };
  });

/** A text file in the bundle (the .bvap), checked as resolveBundleFile does and read from that same open file. */
export const readBundleText = (root: string, rel: string, maxBytes: number): Promise<string> =>
  withBundleFile(root, rel, { maxBytes }, undefined, async (_real, _stats, handle) => handle.readFile("utf-8"));

const withBundleFile = async <T>(
  root: string, rel: string, expect: Expect, noFollow: number | null | undefined,
  use: (real: string, stats: fs.Stats, handle: fs.promises.FileHandle) => Promise<T>,
): Promise<T> => {
  const parts = rel.split("/");
  if (parts.length > 2 || !parts.every(isSafeBundleName) ||
      (parts.length === 2 && parts[0] !== VIDEOS_DIR && parts[0] !== CLIPS_DIR)) throw unsafe(rel);

  const rootStats = await fs.promises.lstat(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw unsafe(rel);

  let file = root;
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part);
    const stats = await lstatIfThere(file);
    if (!stats) throw new Error(`${BUNDLE_INCOMPLETE} ${rel}`);
    const last = index === parts.length - 1;
    if (stats.isSymbolicLink() || !(last ? stats.isFile() : stats.isDirectory())) throw unsafe(rel);
  }

  const real = await fs.promises.realpath(file);
  // Guards a swap between the lstat walk above and this realpath.
  if (!isInsideDir(real, await fs.promises.realpath(root))) throw unsafe(rel);

  const handle = await openBundleFile(real, rel, noFollow);
  try {
    const stats = await inspect(handle, rel, path.extname(real), expect);
    return await use(real, stats, handle);
  } finally {
    await handle.close();
  }
};

/** A received file to copy into the app. `name` is its path in the bundle, for messages. */
export interface BundleCopy {
  source: string;
  target: string;
  size: number;
  name: string;
  media: boolean;
}

/**
 * Copies a received file without trusting that it is still the file
 * resolveBundleFile checked: the source is opened without following links,
 * the open handle must still be a plain file with one link, the planned size
 * and the right magic bytes, and the copy reads from that handle and stops at
 * the planned size. Never replaces the target. Settles once both files are closed.
 */
export const copyBundleFile = async (
  copy: BundleCopy, signal: AbortSignal, onBytes: (bytes: number) => void, noFollow?: number | null,
): Promise<void> => {
  const handle = await openBundleFile(copy.source, copy.name, noFollow);
  try {
    await inspect(handle, copy.name, path.extname(copy.source), {
      maxBytes: Infinity, expectSize: copy.size, media: copy.media,
    });
    const read = handle.createReadStream({
      start: 0, end: Math.max(copy.size - 1, 0), highWaterMark: COPY_CHUNK, autoClose: false,
    });
    const write = fs.createWriteStream(copy.target, { flags: "wx", highWaterMark: COPY_CHUNK });
    read.on("data", chunk => onBytes(chunk.length));
    try {
      await pipeline(read, write, { signal });
    } finally {
      if (!write.closed) await new Promise<void>(resolve => write.once("close", () => resolve()));
    }
  } finally {
    await handle.close();
  }
};

/** A recording used where it is in a received folder changed since the import checked it. */
export const RECEIVED_VIDEO_CHANGED = "ERROR_RECEIVED_VIDEO_CHANGED";

/** What a recording used in place from a received folder was when the import checked it. */
export type ReceivedInPlace = Pick<BundleFile, "size" | "dev" | "ino">;

export type ReceivedCheck = { ok: true } | { ok: false; reason: string };

/**
 * Rechecks a recording used in place from a received folder, whose sender
 * can still change it: `file` must still be the same plain file (device,
 * inode, size, one link), and its real path must still be `file`, so no
 * folder on the way has become a link either.
 */
export const checkReceivedInPlace = (file: string, expected: ReceivedInPlace): ReceivedCheck => {
  const refuse = (reason: string): ReceivedCheck => ({ ok: false, reason });
  try {
    const stats = fs.lstatSync(file, { bigint: true });
    if (stats.isSymbolicLink()) return refuse("symlink");
    if (!stats.isFile()) return refuse("not a file");
    if (stats.nlink !== 1n) return refuse("hard linked");
    if (Number(stats.size) !== expected.size) return refuse("size");
    if (String(stats.dev) !== expected.dev || String(stats.ino) !== expected.ino) return refuse("replaced");
    if (fs.realpathSync.native(file) !== file) return refuse("moved");
    return { ok: true };
  } catch {
    return refuse("missing");
  }
};

/**
 * Throws RECEIVED_VIDEO_CHANGED when `file` is a recording used in place from
 * a received folder and has changed. Any other file is not checked.
 */
export const assertReceivedUnchanged = (
  file: string,
  lookup: (file: string) => ReceivedInPlace | null,
  check: typeof checkReceivedInPlace = checkReceivedInPlace,
): void => {
  const expected = lookup(file);
  if (!expected) return;
  const result = check(file, expected);
  if (!result.ok) {
    console.warn(`Refused a received video (${result.reason}):`, file);
    throw new Error(RECEIVED_VIDEO_CHANGED);
  }
};
