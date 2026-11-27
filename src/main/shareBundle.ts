import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import {
  BUNDLE_IMAGE_EXTENSIONS, BUNDLE_VIDEO_EXTENSIONS, clipFileName, thumbnailFileName, videoFileNames,
} from "./bundleNames.ts";
import { CLIPS_DIR, VIDEOS_DIR } from "./bundleManifest.ts";
import { isInsideDir } from "./insideDir.ts";

export const SHARE_CANCELLED = "ERROR_SHARE_CANCELLED";
export const SHARE_FILE_MISSING = "ERROR_SHARE_FILE_MISSING";
export const SHARE_VIDEO_MISSING = "ERROR_SHARE_VIDEO_MISSING";
export const SHARE_FAILED = "ERROR_SHARE_FAILED";
export const INSUFFICIENT_SPACE = "ERROR_INSUFFICIENT_SPACE";

const COPY_CHUNK = 1024 * 1024;
const PROGRESS_INTERVAL_MS = 100;

export interface ShareCopy {
  /** Real path of the file to copy. */
  source: string;
  /** Relative to the share folder, forward slashes. */
  target: string;
  size: number;
}

export interface ShareProgress {
  copiedBytes: number;
  totalBytes: number;
  copiedFiles: number;
  totalFiles: number;
}

/** A source the share may read: its real path and size, or null. */
export type SourceFile = { path: string; size: number } | null;
export type StatSource = (file: string, extensions: readonly string[]) => Promise<SourceFile>;

const hasExtension = (file: string, extensions: readonly string[]) =>
  extensions.some(extension => file.toLowerCase().endsWith(extension));

/**
 * The real path and size of a file the share may copy: it must exist, be a
 * file after following links, and end in one of `extensions`.
 */
export const statSource: StatSource = async (file, extensions) => {
  if (!file) return null;
  try {
    const real = await fs.promises.realpath(file);
    const stats = await fs.promises.stat(real);
    return stats.isFile() && hasExtension(real, extensions) ? { path: real, size: stats.size } : null;
  } catch {
    return null;
  }
};

export const VIDEO_SOURCE = BUNDLE_VIDEO_EXTENSIONS;
export const THUMBNAIL_SOURCE = BUNDLE_IMAGE_EXTENSIONS;

export interface PlanInput {
  recordings: Array<{ uid: string; video_path: string; video_name: string }>;
  clips: Array<{ uid?: string; output_path: string; thumbnail_path?: string }>;
  includeVideos: boolean;
  stat?: StatSource;
}

/**
 * What a share copies and what its manifest says. Clips without a file are
 * left out; a missing recording is an error only when videos are included.
 * Uids are lowercased, as buildSession writes them.
 */
export const planShareCopies = async ({ recordings, clips, includeVideos, stat = statSource }: PlanInput) => {
  const videos = await Promise.all(recordings.map(video => stat(video.video_path, VIDEO_SOURCE)));
  const missing = recordings.find((_, index) => videos[index] === null);
  if (includeVideos && missing) throw new Error(`${SHARE_VIDEO_MISSING} ${missing.video_name}`);

  const copies: ShareCopy[] = [];
  const names = videoFileNames(recordings.map(video => path.basename(video.video_path)));
  const planned = recordings.map((video, index) => {
    const source = videos[index];
    const videoFile = includeVideos && source ? names[index] : null;
    if (videoFile && source) copies.push({ source: source.path, target: `${VIDEOS_DIR}/${videoFile}`, size: source.size });
    return { uid: video.uid.toLowerCase(), videoFile, path: source?.path ?? null };
  });

  const clipSources = await Promise.all(clips.map(async clip => [
    await stat(clip.output_path, VIDEO_SOURCE),
    await stat(clip.thumbnail_path ?? "", THUMBNAIL_SOURCE),
  ] as const));
  const clipFiles = clips.flatMap((clip, index) => {
    const [file, thumbnail] = clipSources[index];
    if (!clip.uid || !file) return [];
    const uid = clip.uid.toLowerCase();
    const clipFile = clipFileName(uid, file.path);
    copies.push({ source: file.path, target: `${CLIPS_DIR}/${clipFile}`, size: file.size });
    const thumbnailFile = thumbnail ? thumbnailFileName(uid, thumbnail.path) : null;
    if (thumbnail && thumbnailFile) {
      copies.push({ source: thumbnail.path, target: `${CLIPS_DIR}/${thumbnailFile}`, size: thumbnail.size });
    }
    return [{ uid, clipFile, thumbnailFile }];
  });

  return { copies, clipFiles, recordings: planned, totalBytes: copies.reduce((total, copy) => total + copy.size, 0) };
};

/**
 * True when the target has room for `totalBytes` plus 5%. A filesystem that
 * cannot report its free space is allowed: a full disk still fails the copy
 * with ENOSPC, which mapShareError turns into the same message.
 */
export const hasFreeSpace = (statfs: () => { bavail: number; bsize: number }, totalBytes: number): boolean => {
  let free: number;
  try {
    const { bavail, bsize } = statfs();
    free = bavail * bsize;
  } catch {
    return true;
  }
  return free * 100 >= totalBytes * 105;
};

/**
 * Copies without ever replacing a file. A clone when the volume can make one
 * (APFS, Btrfs), which is instant. Otherwise a stream copy that reports bytes
 * as it goes and stops on `signal`; it settles only once the file is closed.
 */
export const copyForShare = async (
  source: string, target: string, signal: AbortSignal, onBytes: (bytes: number) => void, tryClone = true,
): Promise<void> => {
  if (tryClone) {
    try {
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE_FORCE);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EEXIST") throw error;
    }
  }
  const read = fs.createReadStream(source, { highWaterMark: COPY_CHUNK });
  const write = fs.createWriteStream(target, { flags: "wx", highWaterMark: COPY_CHUNK });
  read.on("data", chunk => onBytes(chunk.length));
  try {
    await pipeline(read, write, { signal });
  } finally {
    if (!write.closed) await new Promise<void>(resolve => write.once("close", () => resolve()));
  }
};

/** The app's error code for a failed share, from the errno that caused it. */
export const mapShareError = (code: string | undefined): string => {
  if (code === "ENOSPC") return INSUFFICIENT_SPACE;
  if (code === "ENOENT") return SHARE_FILE_MISSING;
  return SHARE_FAILED;
};

/** What copyFiles was doing when it stopped, and every file it created, a partial one included. */
export interface CopyState {
  current: ShareCopy | null;
  written: string[];
}

/**
 * Copies each file to its absolute `target` in turn, never replacing one, and
 * reports progress as it goes. Throws SHARE_CANCELLED on abort; `state` says
 * which files to remove afterwards.
 */
export const copyFiles = async (
  copies: ShareCopy[], signal: AbortSignal, onProgress: (progress: ShareProgress) => void,
  state: CopyState, tryClone?: boolean,
): Promise<void> => {
  const totalBytes = copies.reduce((total, copy) => total + copy.size, 0);
  let copiedBytes = 0;
  let sentAt = 0;
  const progress = (copiedFiles: number, now: boolean) => {
    if (!now && Date.now() - sentAt < PROGRESS_INTERVAL_MS) return;
    sentAt = Date.now();
    onProgress({ copiedBytes, totalBytes, copiedFiles, totalFiles: copies.length });
  };

  progress(0, true);
  for (const [index, copy] of copies.entries()) {
    if (signal.aborted) throw new Error(SHARE_CANCELLED);
    state.current = copy;
    const before = copiedBytes;
    try {
      await copyForShare(copy.source, copy.target, signal, bytes => {
        copiedBytes += bytes;
        progress(index, false);
      }, tryClone);
    } catch (error) {
      // EEXIST means the file was there before this copy, so it is not ours to remove.
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") state.written.push(copy.target);
      throw error;
    }
    state.written.push(copy.target);
    copiedBytes = before + copy.size;
    progress(index + 1, true);
  }
  state.current = null;
};

/** The error code for a failed copy, naming the file when its source went missing. */
export const copyErrorCode = (error: unknown, state: CopyState): string => {
  const code = mapShareError((error as NodeJS.ErrnoException).code);
  return code === SHARE_FILE_MISSING && state.current ? `${code} ${path.basename(state.current.source)}` : code;
};

export interface RunShareInput {
  /** Real path of the folder the coach picked. */
  parent: string;
  folderName: string;
  copies: ShareCopy[];
  /** Writes the .bvap into the finished folder. Runs last. */
  writeBvap: (folder: string) => Promise<void>;
  signal: AbortSignal;
  onProgress: (progress: ShareProgress) => void;
  /** Runs after the .bvap is written. A failure here is logged; the share stands. */
  onComplete?: (folder: string) => void | Promise<void>;
  /** For tests; a clone is tried first otherwise. */
  tryClone?: boolean;
}

/**
 * Creates `<parent>/<folderName>`, copies into it, writes the .bvap last.
 * On failure or cancel it removes that folder, and only that folder: never
 * one it did not create, never one whose real path left `parent`.
 */
export const runShare = async (input: RunShareInput): Promise<string> => {
  const { parent, folderName, copies, writeBvap, signal, onProgress } = input;
  const folder = path.join(parent, folderName);
  try {
    await fs.promises.mkdir(folder);
  } catch (error) {
    console.error("Error creating share folder:", error);
    throw new Error(SHARE_FAILED);
  }

  const state: CopyState = { current: null, written: [] };
  try {
    for (const dir of new Set(copies.map(copy => copy.target.split("/")[0]))) {
      await fs.promises.mkdir(path.join(folder, dir));
    }
    await copyFiles(
      copies.map(copy => ({ ...copy, target: path.join(folder, ...copy.target.split("/")) })),
      signal, onProgress, state, input.tryClone,
    );
    if (signal.aborted) throw new Error(SHARE_CANCELLED);
    await writeBvap(folder);
  } catch (error) {
    await removeShareFolder(folder, parent);
    if (signal.aborted) throw new Error(SHARE_CANCELLED);
    console.error("Error sharing project:", error);
    throw new Error(copyErrorCode(error, state));
  }

  try {
    await input.onComplete?.(folder);
  } catch (error) {
    console.error("Share finished, but its follow-up step failed:", error);
  }
  return folder;
};

const removeShareFolder = async (folder: string, parent: string): Promise<void> => {
  try {
    const real = await fs.promises.realpath(folder);
    if (!isInsideDir(real, await fs.promises.realpath(parent))) {
      console.error("Not removing a share folder outside its parent:", real);
      return;
    }
    await fs.promises.rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    console.error("Error removing unfinished share folder:", error);
  }
};
