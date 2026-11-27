import fs from "fs";
import path from "path";
import { CLIPS_DIR, VIDEOS_DIR } from "./bundleManifest.ts";
import { isSafeBundleName } from "./bundleNames.ts";
import { isInsideDir } from "./insideDir.ts";

/** A symlink, something other than a file, a path that leaves the folder, or a file over its cap. */
export const BUNDLE_FILE_UNSAFE = "ERROR_BUNDLE_FILE_UNSAFE";
/** A video whose size is not the one its fingerprint gives. */
export const BUNDLE_FILE_CHANGED = "ERROR_BUNDLE_FILE_CHANGED";

export const MAX_BUNDLE_VIDEO_BYTES = 200 * 1024 ** 3;
export const MAX_BUNDLE_CLIP_BYTES = 20 * 1024 ** 3;
export const MAX_BUNDLE_THUMBNAIL_BYTES = 20 * 1024 ** 2;

export interface BundleFile {
  /** Real path, inside the bundle folder. */
  path: string;
  size: number;
}

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
 * trusted. `rel` is `<name>` or `videos/<name>` / `clips/<name>`. The root,
 * the folder and the file are each lstat'd: no symlinks, the folders must be
 * folders and the file a file, and its real path must stay inside the root.
 * Returns null when the file is not there and throws BUNDLE_FILE_UNSAFE (or
 * BUNDLE_FILE_CHANGED for a size that is not `expectSize`) before anything
 * reads it.
 */
export const resolveBundleFile = async (
  root: string, rel: string, { maxBytes, expectSize }: { maxBytes: number; expectSize?: number },
): Promise<BundleFile | null> => {
  const unsafe = () => new Error(`${BUNDLE_FILE_UNSAFE} ${rel}`);
  const parts = rel.split("/");
  if (parts.length > 2 || !parts.every(isSafeBundleName) ||
      (parts.length === 2 && parts[0] !== VIDEOS_DIR && parts[0] !== CLIPS_DIR)) throw unsafe();

  const rootStats = await fs.promises.lstat(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw unsafe();

  let file = root;
  let stats = rootStats;
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part);
    const found = await lstatIfThere(file);
    if (!found) return null;
    stats = found;
    const last = index === parts.length - 1;
    if (stats.isSymbolicLink() || !(last ? stats.isFile() : stats.isDirectory())) throw unsafe();
  }

  const real = await fs.promises.realpath(file);
  if (!isInsideDir(real, await fs.promises.realpath(root))) throw unsafe();
  if (stats.size > maxBytes) throw unsafe();
  if (expectSize !== undefined && stats.size !== expectSize) throw new Error(`${BUNDLE_FILE_CHANGED} ${rel}`);
  return { path: real, size: stats.size };
};
