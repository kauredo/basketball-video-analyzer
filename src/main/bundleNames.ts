/** Longest name the share folder uses, in characters. Leaves room for the path above it on Windows. */
export const MAX_BUNDLE_NAME = 120;

const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i;

/**
 * A file or folder name every platform accepts, or `fallback` when nothing is
 * left. Strips what Windows refuses, trailing dots and spaces (Windows drops
 * them), and renames the reserved device names.
 */
export const safeName = (name: string, fallback: string): string => {
  let safe = name.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "").trim();
  // Cap by code point so a cut never splits an emoji or other surrogate pair.
  safe = Array.from(safe).slice(0, MAX_BUNDLE_NAME).join("").replace(/[\s.]+$/, "");
  if (safe === "") return fallback;
  return RESERVED.test(safe) ? `_${safe}` : safe;
};

const splitExtension = (name: string): [string, string] => {
  const match = /^(.+?)(\.[A-Za-z0-9]{1,10})$/.exec(name);
  return match ? [match[1], match[2]] : [name, ""];
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

/**
 * Names for the recordings in `videos/`, unique ignoring case so the folder
 * unpacks the same on Windows and macOS.
 */
export const videoFileNames = (names: string[]): string[] => {
  const taken = new Set<string>();
  return names.map(name => {
    const unique = uniqueName(safeName(name, "video"), candidate => taken.has(candidate.toLowerCase()), true);
    taken.add(unique.toLowerCase());
    return unique;
  });
};

/** `<uid><extension of source>`, for a clip or its thumbnail. An odd extension is dropped. */
export const uidFileName = (uid: string, source: string): string => {
  const match = /\.[A-Za-z0-9]{1,10}$/.exec(source);
  return `${uid}${match ? match[0].toLowerCase() : ""}`;
};
