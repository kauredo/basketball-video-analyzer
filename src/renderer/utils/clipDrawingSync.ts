import type { Annotation } from "../../types/global";

// Mirrors MAX_CLIP_DRAWINGS in src/main/clipDrawings.ts, which main enforces.
export const MAX_CLIP_DRAWINGS = 20;

// Saved drawings that show up in a clip of [start, end): the ones inside it,
// plus a non-pausing one still on screen at mark-in. Main applies the same
// rule and cap.
export const selectClipAnnotations = (
  annotations: Annotation[],
  start: number,
  end: number,
  defaultSeconds: number
): Annotation[] =>
  annotations
    .filter(a => {
      if (a.timestamp >= end) return false;
      if (a.timestamp >= start) return true;
      return !a.pause_playback && a.timestamp + (a.display_seconds ?? defaultSeconds) > start;
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_CLIP_DRAWINGS);

// Names the drawings a clip file was cut with, so a clip whose file is out of
// date can be found by comparing keys. "" means no drawings.
export const clipDrawingsKey = (shown: Annotation[], defaultSeconds: number): string =>
  shown
    .map(a => `${a.id}:${a.display_seconds ?? defaultSeconds}:${a.pause_playback ? 1 : 0}`)
    .join(",");

// main stores clip paths through path.normalize, which uses backslashes on
// Windows.
export const samePath = (a: string, b: string): boolean =>
  a.replace(/\\/g, "/") === b.replace(/\\/g, "/");
