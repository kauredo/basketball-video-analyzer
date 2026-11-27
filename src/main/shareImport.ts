import fs from "fs";
import path from "path";
import type { BundleFile } from "./bundleFiles.ts";
import type { Fingerprint } from "./bundleManifest.ts";
import { uniqueName } from "./bundleNames.ts";
import {
  SHARE_CANCELLED, copyErrorCode, copyFiles, type CopyState, type ShareCopy, type ShareProgress,
} from "./shareBundle.ts";

export const IMPORT_CANCELLED = "ERROR_IMPORT_CANCELLED";

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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

export interface ImportPlanInput {
  /** One per recording, in session order. `bundled` ones are copied when `copyVideos` is set. */
  recordings: Array<{ path: string; size: number; bundled: boolean }>;
  /** One per session clip; null for a clip the bundle has no file for. */
  clips: Array<BundledClip | null>;
  copyVideos: boolean;
  videosDir: string;
  clipsDir: string;
  exists: (file: string) => boolean;
  /** A fresh name for each clip file. */
  newName: () => string;
}

/** What an import copies, where each recording ends up, and each clip's files. Never plans over a file that exists. */
export const planImportCopies = (input: ImportPlanInput) => {
  const copies: ShareCopy[] = [];
  const planned = new Set<string>();
  const copyTo = (source: BundleFile, dir: string, name: string): string => {
    const unique = uniqueName(name, candidate => {
      const target = path.join(dir, candidate);
      return planned.has(target.toLowerCase()) || input.exists(target);
    }, true);
    const target = path.join(dir, unique);
    planned.add(target.toLowerCase());
    copies.push({ source: source.path, target, size: source.size });
    return target;
  };

  const paths = input.recordings.map(recording =>
    recording.bundled && input.copyVideos
      ? copyTo({ path: recording.path, size: recording.size }, input.videosDir, path.basename(recording.path))
      : recording.path);

  const clipFiles = input.clips.map(bundled => {
    if (!bundled) return null;
    const name = input.newName();
    const extension = (file: BundleFile) => path.extname(file.path).toLowerCase();
    return {
      output: copyTo(bundled.clip, input.clipsDir, `${name}${extension(bundled.clip)}`),
      thumbnail: bundled.thumbnail
        ? copyTo(bundled.thumbnail, input.clipsDir, `${name}-thumb${extension(bundled.thumbnail)}`)
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
  copies: ShareCopy[];
  /** Writes the rows, in one transaction. Runs once every copy is done. */
  write: () => T;
  signal: AbortSignal;
  onProgress: (progress: ShareProgress) => void;
  /** For tests; a clone is tried first otherwise. */
  tryClone?: boolean;
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
    await copyFiles(copies, signal, input.onProgress, state, input.tryClone);
    if (signal.aborted) throw new Error(SHARE_CANCELLED);
    copying = false;
    return input.write();
  } catch (error) {
    await removeImported(state.written, createdDirs);
    if (signal.aborted) throw new Error(IMPORT_CANCELLED);
    console.error("Error importing a shared project:", error);
    throw copying ? new Error(copyErrorCode(error, state)) : error;
  }
};

/**
 * The 'received' snapshot of a .bvap with a share id: the session as it came,
 * without its share and bundle blocks, as the sender stored it.
 */
export const receivedSnapshot = (raw: unknown): { id: string; data: string } | null => {
  if (!record(raw) || !record(raw.share) || typeof raw.share.id !== "string" || !UID.test(raw.share.id)) return null;
  const { share, bundle, ...session } = raw;
  return { id: (share as { id: string }).id.toLowerCase(), data: JSON.stringify(session) };
};
