import path from "path";

/** True when `filePath` sits somewhere below `dir`. Both should already be real paths. */
export const isInsideDir = (filePath: string, dir: string): boolean => {
  const relative = path.relative(dir, filePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};
