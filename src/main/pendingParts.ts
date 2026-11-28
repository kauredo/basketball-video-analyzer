import fs from "node:fs";

// Partial playable copies, listed in a file in userData while ffmpeg writes
// them, so a crash or force-quit doesn't leave one in the coach's folder for good.

const PART_NAME = /\.mp4\.[0-9a-f]{8}\.part$/i;

const read = (listFile: string): string[] => {
  try {
    const list: unknown = JSON.parse(fs.readFileSync(listFile, "utf8"));
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const write = (listFile: string, parts: string[]) => {
  if (parts.length === 0) fs.rmSync(listFile, { force: true });
  else fs.writeFileSync(listFile, JSON.stringify(parts));
};

export const isPartName = (file: string): boolean => PART_NAME.test(file);

export const recordPart = (listFile: string, part: string): void => {
  if (!isPartName(part)) throw new Error(`not a partial copy: ${part}`);
  write(listFile, [...read(listFile).filter(item => item !== part), part]);
};

export const forgetPart = (listFile: string, part: string): void => {
  write(listFile, read(listFile).filter(item => item !== part));
};

// ffmpeg writes to a live copy every second. Nothing stops a second app
// window, so a part written to recently may still be one, and is kept.
const STALE_MS = 5 * 60_000;

/** Deletes listed partial copies left on disk by an earlier run, and keeps live ones listed. */
export const sweepParts = (listFile: string, now = Date.now()): string[] => {
  const removed: string[] = [];
  const live: string[] = [];
  for (const part of read(listFile)) {
    // The list lives in userData, but only a name the app gives a partial copy is ever deleted.
    if (!isPartName(part)) continue;
    try {
      const stat = fs.lstatSync(part);
      if (!stat.isFile()) continue;
      if (now - stat.mtimeMs < STALE_MS) {
        live.push(part);
        continue;
      }
      fs.unlinkSync(part);
      removed.push(part);
    } catch {
      // already gone
    }
  }
  write(listFile, live);
  return removed;
};
