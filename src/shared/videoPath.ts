// Formats a project video can have. The open dialog offers these and the convert-only ones.
export const VIDEO_EXTENSIONS =[".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];

// Formats the open dialog also offers, though a project never keeps one: the
// app makes an MP4 copy first. Camcorders record .mts and .m2ts.
export const CONVERT_ONLY_EXTENSIONS = [".mts", ".m2ts", ".ts", ".mpg", ".mpeg", ".vob", ".3gp", ".mxf"];

export const PICKER_EXTENSIONS = [...VIDEO_EXTENSIONS, ...CONVERT_ONLY_EXTENSIONS].map(ext => ext.slice(1));

export const hasVideoExtension = (filePath: unknown): filePath is string =>
  typeof filePath === "string" &&
  VIDEO_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(ext));
