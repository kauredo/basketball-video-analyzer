import fs from "fs";
import path from "path";
import { isInsideDir } from "./insideDir.ts";

export type VideosDirRemoval = "removed" | "missing" | "refused" | "in-use";

/**
 * Removes `videosRoot/<uid>`, the folder the app copies a shared project's
 * recordings into. Only call it once the project's rows are gone. The whole
 * folder is the app's, so a copy a recording was relinked away from goes too.
 * It refuses a symlink or anything that does not resolve to a direct child of
 * `videosRoot`, and keeps the folder while `pathsInUse` (every recording any
 * project still plays) has a file in it.
 */
export const removeProjectVideosDir = async (
  videosRoot: string, uid: string, pathsInUse: string[],
): Promise<VideosDirRemoval> => {
  const root = await fs.promises.realpath(videosRoot).catch(() => null);
  if (!root) return "missing";
  const dir = path.join(root, uid);
  const stat = await fs.promises.lstat(dir).catch(() => null);
  if (!stat) return "missing";
  if (!stat.isDirectory() || path.dirname(dir) !== root) return "refused";

  const used = await Promise.all(pathsInUse.map(async used => {
    const real = await fs.promises.realpath(used).catch(() => used);
    return isInsideDir(real, dir) || isInsideDir(used, dir);
  }));
  if (used.some(Boolean)) return "in-use";
  await fs.promises.rm(dir, { recursive: true, force: true });
  return "removed";
};
