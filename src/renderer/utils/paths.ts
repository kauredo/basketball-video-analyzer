// Convert a local filesystem path into a file:// URL usable as a media src.
export const formatVideoSrc = (path: string): string => {
  if (path.startsWith("file://")) {
    return path;
  }
  // Windows paths (drive letter, e.g. C:\ or C:/)
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    const normalizedPath = path.replace(/\\/g, "/");
    return `file:///${normalizedPath}`;
  }
  // Unix-like absolute paths
  if (path.startsWith("/")) {
    return `file://${path}`;
  }
  return `file://${path}`;
};
