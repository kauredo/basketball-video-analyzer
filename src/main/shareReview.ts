import { EXISTS, type DiffItem, type ShareDiff } from "./shareDiff.ts";
import { countUsers, rowsOf, usersOf } from "./shareMerge.ts";
import type { ParsedSession } from "./sessionData.ts";
import type { ReviewRow, ReviewValue, ShareReview } from "../shared/shareReview.ts";

const shapeCount = (data: unknown): number => {
  try {
    const shapes: unknown = JSON.parse(data as string);
    return Array.isArray(shapes) ? shapes.length : 0;
  } catch {
    return 0;
  }
};

/**
 * The diff as the renderer sees it: uids only in tokens, names instead of
 * ids, no paths. `bundled` holds the clips whose cut file came with the share.
 */
export const reviewSummary = (
  diff: ShareDiff, mine: ParsedSession, theirs: ParsedSession, bundled: Set<string>,
): ShareReview => {
  type Side = "mine" | "theirs";
  const byUid = <T extends { uid: string | null }>(rows: T[]) => new Map(rows.map(row => [row.uid as string, row]));
  const lookup = (session: ParsedSession) => ({
    category: byUid(session.categories),
    player: byUid(session.players),
    recording: byUid(session.recordings),
    clip: byUid(session.clips),
    drawing: byUid(session.drawings),
  });
  const sides = { mine: lookup(mine), theirs: lookup(theirs) };
  // A side's own row first: a name on my side reads as I have it.
  const either = <K extends keyof ReturnType<typeof lookup>>(key: K, uid: string, side: Side) =>
    (sides[side][key].get(uid) ?? sides[side === "mine" ? "theirs" : "mine"][key].get(uid)) as
      ReturnType<typeof lookup>[K] extends Map<string, infer V> ? V | undefined : never;

  const value = (field: string, raw: unknown, side: Side): ReviewValue => {
    switch (field) {
      case EXISTS:
        return { type: "exists", exists: raw === true };
      case "time": {
        const [start, end] = raw as number[];
        return { type: "time", start, end };
      }
      case "timestamp":
      case "displaySeconds":
        return { type: "seconds", seconds: raw as number | null };
      case "categories":
        return {
          type: "tags",
          tags: (raw as string[]).map(uid => either("category", uid, side))
            .filter(cat => cat !== undefined)
            .map(cat => ({ name: cat.name, color: cat.color })),
        };
      case "players":
        return {
          type: "tags",
          tags: (raw as string[]).map(uid => either("player", uid, side))
            .filter(player => player !== undefined)
            .map(player => ({ name: player.number ? `#${player.number} ${player.name}` : player.name, color: null })),
        };
      case "parent":
        return { type: "text", text: raw ? either("category", raw as string, side)?.name ?? "" : "" };
      case "recording":
        return { type: "text", text: either("recording", raw as string, side)?.videoName ?? "" };
      case "color":
        return { type: "color", color: raw as string };
      case "pausePlayback":
        return { type: "flag", on: raw === true };
      case "status":
        return { type: "status", status: raw as ParsedSession["clips"][number]["status"] };
      case "court":
        return { type: "court", set: raw !== null };
      case "data":
        return { type: "shapes", count: shapeCount(raw) };
      default:
        return { type: "text", text: (raw as string | null) ?? "" };
    }
  };
  const fields = (changes: DiffItem["changes"]) => changes.map(change => ({
    field: change.field, mine: value(change.field, change.mine, "mine"), theirs: value(change.field, change.theirs, "theirs"),
  }));

  const preview = (item: DiffItem): ReviewRow["preview"] => {
    // The row as the coach knows it; their copy only for what is new here.
    const side: Side = sides.mine[item.kind].has(item.uid) ? "mine" : "theirs";
    switch (item.kind) {
      case "clip": {
        const clip = either("clip", item.uid, side)!;
        const tags = value("categories", clip.categoryKeys, side);
        return { title: clip.title, start: clip.startTime, end: clip.endTime, tags: tags.type === "tags" ? tags.tags : [] };
      }
      case "drawing": {
        const drawing = either("drawing", item.uid, side)!;
        const session = side === "theirs" ? theirs : mine;
        const clip = session.clips.find(row => row.recordingUid === drawing.recordingUid &&
          row.startTime <= drawing.timestamp && drawing.timestamp <= row.endTime);
        return {
          title: clip?.title ?? either("recording", drawing.recordingUid as string, side)?.videoName ?? "",
          start: drawing.timestamp,
        };
      }
      case "category": {
        const cat = either("category", item.uid, side)!;
        return {
          title: cat.name,
          color: cat.color,
          detail: cat.parentKey ? either("category", cat.parentKey, side)?.name : undefined,
        };
      }
      case "player": {
        const player = either("player", item.uid, side)!;
        return { title: player.name, detail: player.number ? `#${player.number}` : undefined };
      }
      case "recording":
        return { title: either("recording", item.uid, side)!.videoName };
    }
  };

  const counts = countUsers(rowsOf(mine));
  // A new clip, or their time or video, keeps a cut file only when the share brought one.
  const recut = (item: DiffItem): boolean => {
    if (item.kind !== "clip" || bundled.has(item.uid) || !sides.theirs.clip.has(item.uid)) return false;
    return !sides.mine.clip.has(item.uid) ||
      [...item.changes, ...item.conflicts].some(change => change.field === "time" || change.field === "recording");
  };

  return {
    hasBase: diff.hasBase,
    rows: diff.items.map(item => ({
      token: item.token,
      kind: item.kind,
      group: item.group,
      ticked: item.ticked,
      preview: preview(item),
      changes: fields(item.changes),
      conflicts: fields(item.conflicts),
      inUse: item.group === "deleted" ? usersOf(counts, item.kind, item.uid) : 0,
      recut: recut(item),
    })),
  };
};
