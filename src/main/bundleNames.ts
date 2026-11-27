import { VIDEO_EXTENSIONS } from "../shared/videoPath.ts";

/** Longest name the share folder uses, in characters. Leaves room for the path above it on Windows. */
export const MAX_BUNDLE_NAME = 120;

/** What `videos/` and a clip's file may end in. Lowercase: the writer lowercases every extension. */
export const BUNDLE_VIDEO_EXTENSIONS: readonly string[] = VIDEO_EXTENSIONS;
export const BUNDLE_IMAGE_EXTENSIONS: readonly string[] = [".jpg", ".jpeg", ".png"];

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f\u007f]/;
const ILLEGAL_ALL = new RegExp(ILLEGAL.source, "g");
const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i;

/**
 * The one name rule for files and folders in a bundle, used by the writer
 * (safeName) and the parser (bundleManifest). Refuses what Windows refuses:
 * reserved device names, a trailing dot or space, control characters and
 * `<>:"/\|?*`. A leading dot is refused too, so nothing in a bundle is hidden
 * and `.` and `..` can never appear.
 */
export const isSafeBundleName = (name: string): boolean =>
  name.length > 0 && name.length <= 255 && !ILLEGAL.test(name) && !name.startsWith(".") &&
  !/[\s.]$/.test(name) && !RESERVED.test(name);

/** True when `name` ends in one of `extensions`, matched exactly (so lowercase). */
export const hasBundleExtension = (name: string, extensions: readonly string[]): boolean =>
  extensions.some(extension => name.length > extension.length && name.endsWith(extension));

const splitExtension = (name: string): [string, string] => {
  const match = /^(.*?)(\.[A-Za-z0-9]{1,10})$/.exec(name);
  return match ? [match[1], match[2]] : [name, ""];
};

/**
 * A file or folder name that passes isSafeBundleName, or `fallback` (plus the
 * extension) when nothing is left. A name over the cap loses characters from
 * the stem, never from the extension.
 */
export const safeName = (name: string, fallback: string): string => {
  const [rawStem, extension] = splitExtension(name.replace(ILLEGAL_ALL, "").trim());
  // Cap by code point so a cut never splits an emoji or other surrogate pair.
  const stem = Array.from(rawStem.replace(/^[\s.]+/, ""))
    .slice(0, MAX_BUNDLE_NAME - extension.length).join("").replace(/[\s.]+$/, "");
  const safe = `${stem || fallback}${extension}`;
  return RESERVED.test(safe) ? `_${safe}` : safe;
};

/**
 * `name`, or `name (2)`, `name (3)`... until `isTaken` says no. Files keep
 * their extension last: `game (2).mp4`.
 */
export const uniqueName = (name: string, isTaken: (candidate: string) => boolean, keepExtension = false): string => {
  const [stem, extension] = keepExtension ? splitExtension(name) : [name, ""];
  let candidate = name;
  for (let n = 2; isTaken(candidate); n++) candidate = `${stem} (${n})${extension}`;
  return candidate;
};

const lowerExtension = (name: string): string => {
  const [stem, extension] = splitExtension(name);
  return `${stem}${extension.toLowerCase()}`;
};

/**
 * Names for the recordings in `videos/`, from their file names. Extensions are
 * lowercased (cameras write .MP4) and names are unique ignoring case, so the
 * folder unpacks the same on Windows and macOS.
 */
export const videoFileNames = (names: string[]): string[] => {
  const taken = new Set<string>();
  return names.map(name => {
    const unique = uniqueName(lowerExtension(safeName(name, "video")), candidate => taken.has(candidate.toLowerCase()), true);
    taken.add(unique.toLowerCase());
    return unique;
  });
};

const sourceExtension = (source: string): string => {
  const match = /\.[A-Za-z0-9]{1,10}$/.exec(source);
  return match ? match[0].toLowerCase() : "";
};

/** `<uid>.<ext of source>`, for a clip. */
export const clipFileName = (uid: string, source: string): string => `${uid}${sourceExtension(source)}`;

/** `<uid>-thumb.<ext of source>`, so a thumbnail never collides with its clip. */
export const thumbnailFileName = (uid: string, source: string): string => `${uid}-thumb${sourceExtension(source)}`;
