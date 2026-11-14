// Every format the open dialog offers, plus the extra ones the clip creator accepts.
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];

export const hasVideoExtension = (filePath: unknown): filePath is string =>
  typeof filePath === "string" &&
  VIDEO_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(ext));
