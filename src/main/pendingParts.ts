import fs from "node:fs";
import path from "node:path";

// Partial playable copies, listed in a file in userData while ffmpeg writes
// them, so a crash or force-quit doesn't leave one in the coach's folder for good.

const PART_NAME = /\.mp4\.[0-9a-f]{8}\.part$/i;

/** A partial copy and the process writing it. */
type Entry = { part: string; pid: number };

const read = (listFile: string): Entry[] => {
  try {
    const list: unknown = JSON.parse(fs.readFileSync(listFile, "utf8"));
    return Array.isArray(list)
      ? list.filter((item): item is Entry =>
        typeof item?.part === "string" && Number.isSafeInteger(item?.pid))
      : [];
  } catch {
    return [];
  }
};

const write = (listFile: string, entries: Entry[]) => {
  if (entries.length === 0) {
    fs.rmSync(listFile, { force: true });
    return;
  }
  // Written beside the list and renamed, so a crash mid-write can't truncate it.
  const temp = `${listFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(entries));
  fs.renameSync(temp, listFile);
};

export const isPartName = (file: string): boolean => path.isAbsolute(file) && PART_NAME.test(file);

export const recordPart = (listFile: string, part: string, pid = process.pid): void => {
  if (!isPartName(part)) throw new Error(`not a partial copy: ${part}`);
  write(listFile, [...read(listFile).filter(entry => entry.part !== part), { part, pid }]);
};

export const forgetPart = (listFile: string, part: string): void => {
  write(listFile, read(listFile).filter(entry => entry.part !== part));
};

const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Deletes listed partial copies whose writer is gone, such as after a crash.
 * Another app window still writing its copy keeps that entry, and so does a
 * file that can't be deleted yet, so the next launch tries again.
 */
export const sweepParts = (listFile: string, isRunning = running): string[] => {
  const removed: string[] = [];
  const kept: Entry[] = [];
  for (const entry of read(listFile)) {
    // The list lives in userData, but only a name the app gives a partial copy is ever deleted.
    if (!isPartName(entry.part)) continue;
    if (entry.pid !== process.pid && isRunning(entry.pid)) {
      kept.push(entry);
      continue;
    }
    try {
      if (!fs.lstatSync(entry.part).isFile()) continue;
      fs.unlinkSync(entry.part);
      removed.push(entry.part);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") kept.push(entry);
    }
  }
  write(listFile, kept);
  return removed;
};
