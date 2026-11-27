import path from "path";
import { EXISTS, sessionRows, type DiffItem, type Fields, type ItemKind, type ShareDiff } from "./shareDiff.ts";
import { INVALID_INPUT } from "./shareImport.ts";
import type { ParsedSession } from "./sessionData.ts";
import { insertShareSnapshot, type ShareSnapshot } from "./shareSnapshots.ts";

export type Choice = "mine" | "theirs";

/**
 * The base a returning share is compared with: the 'sent' snapshot it names
 * as `basedOn`, from this project. A share already received here is its own
 * base, so opening the same file twice shows nothing new.
 */
export const pickBase = (
  share: { id: string | null; basedOn: string | null },
  projectId: number,
  getSnapshot: (id: string) => ShareSnapshot | null,
): ShareSnapshot | null => {
  const received = share.id ? getSnapshot(share.id) : null;
  if (received?.project_id === projectId && received.direction === "received") return received;
  const sent = share.basedOn ? getSnapshot(share.basedOn) : null;
  return sent?.project_id === projectId && sent.direction === "sent" ? sent : null;
};

/** What the bundle has to provide: every recording I don't have, and a cut file for clips that are new or moved. */
export const mergeNeeds = (diff: ShareDiff, mine: ParsedSession): { recordings: string[]; clips: string[] } => {
  const mineRecordings = new Set(mine.recordings.map(video => video.uid));
  const clips = diff.items.filter(item => item.kind === "clip" && (
    item.group === "new" ||
    [...item.changes, ...item.conflicts].some(change =>
      change.field === "time" || change.field === "recording" || (change.field === EXISTS && change.theirs === true))));
  return {
    recordings: diff.items
      .filter(item => item.kind === "recording" && !mineRecordings.has(item.uid))
      .map(item => item.uid),
    clips: clips.map(item => item.uid),
  };
};

export interface MergeSelections {
  selected: Set<string>;
  choices: Map<string, Map<string, Choice>>;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The coach's picks as the renderer sent them: `selected` maps a row's token
 * to a boolean, `choices` maps it to { field: "mine" | "theirs" } for its
 * conflicting fields. Anything that is not a row or field of this diff is refused.
 */
export const validateSelections = (diff: ShareDiff, input: unknown): MergeSelections => {
  const refuse = () => new Error(INVALID_INPUT);
  if (!record(input) || !record(input.selected) || !record(input.choices)) throw refuse();
  const items = new Map(diff.items.map(item => [item.token, item]));
  const selected = new Set<string>();
  for (const [token, value] of Object.entries(input.selected)) {
    if (!items.has(token) || typeof value !== "boolean") throw refuse();
    if (value) selected.add(token);
  }
  const choices = new Map<string, Map<string, Choice>>();
  for (const [token, fields] of Object.entries(input.choices)) {
    const item = items.get(token);
    if (!item || !record(fields)) throw refuse();
    const picks = new Map<string, Choice>();
    for (const [field, choice] of Object.entries(fields)) {
      if (!item.conflicts.some(conflict => conflict.field === field) || (choice !== "mine" && choice !== "theirs")) {
        throw refuse();
      }
      picks.set(field, choice);
    }
    choices.set(token, picks);
  }
  return { selected, choices };
};

export type MergeOp =
  | { op: "insert"; kind: ItemKind; uid: string; row: Fields }
  | { op: "update"; kind: ItemKind; uid: string; fields: Fields }
  | { op: "delete"; kind: ItemKind; uid: string };

export interface MergePlan {
  ops: MergeOp[];
  /** Tokens of ticked deletions left in place because something still uses them. */
  kept: string[];
  /** Recordings inserted, in op order; each needs a video path. */
  newRecordings: string[];
  /** Clips inserted or moved in time or recording; each takes its bundled cut file, or needs a re-cut. */
  clipFiles: string[];
}

const PHASES: Array<[MergeOp["op"], ItemKind]> = [
  ["insert", "recording"], ["insert", "category"], ["insert", "player"],
  ["update", "category"], ["update", "player"],
  ["insert", "clip"], ["update", "clip"], ["insert", "drawing"], ["update", "drawing"],
  ["delete", "clip"], ["delete", "drawing"], ["delete", "category"], ["delete", "player"], ["delete", "recording"],
];

/** Turns the ticked rows into row operations, keyed by uid. Nothing unticked is touched. */
export const planMerge = (
  diff: ShareDiff, mine: ParsedSession, theirs: ParsedSession, selections: MergeSelections,
): MergePlan => {
  const rows = (session: ParsedSession) =>
    new Map<ItemKind, Map<string, Fields>>((["recording", "category", "player", "clip", "drawing"] as ItemKind[])
      .map(kind => [kind, sessionRows(session, kind)]));
  const mineRows = rows(mine);
  const theirRows = rows(theirs);
  const ops: MergeOp[] = [];

  const pickedOp = (item: DiffItem): MergeOp | null => {
    const { kind, uid } = item;
    const theirsRow = () => theirRows.get(kind)!.get(uid)!;
    if (item.group === "new") return { op: "insert", kind, uid, row: theirsRow() };
    if (item.group === "deleted") return { op: "delete", kind, uid };
    const picks = selections.choices.get(item.token);
    const theirsWins = (field: string) => picks?.get(field) === "theirs";
    if (item.conflicts[0]?.field === EXISTS) {
      if (!theirsWins(EXISTS)) return null;
      return item.conflicts[0].theirs === true ? { op: "insert", kind, uid, row: theirsRow() } : { op: "delete", kind, uid };
    }
    const fields: Fields = {};
    for (const change of item.changes) fields[change.field] = change.theirs;
    for (const conflict of item.conflicts) if (theirsWins(conflict.field)) fields[conflict.field] = conflict.theirs;
    return Object.keys(fields).length ? { op: "update", kind, uid, fields } : null;
  };
  for (const item of diff.items) {
    if (!selections.selected.has(item.token)) continue;
    const op = pickedOp(item);
    if (op) ops.push(op);
  }

  // The rows after the merge, per kind, to check what still points where.
  const after = (kind: ItemKind): Map<string, Fields> => {
    const result = new Map(mineRows.get(kind)!);
    for (const op of ops) {
      if (op.kind !== kind) continue;
      if (op.op === "insert") result.set(op.uid, op.row);
      else if (op.op === "update") result.set(op.uid, { ...result.get(op.uid), ...op.fields });
      else result.delete(op.uid);
    }
    return result;
  };

  // A ticked clip, drawing or subcategory brings the new recording or parent it sits on.
  const bring = (kind: ItemKind, field: string, target: ItemKind) => {
    for (;;) {
      const present = after(target);
      const missing = [...after(kind).values()]
        .map(row => row[field] as string | null)
        .find(uid => uid && !present.has(uid) && theirRows.get(target)!.has(uid) && !mineRows.get(target)!.has(uid));
      if (!missing) return;
      ops.push({ op: "insert", kind: target, uid: missing, row: theirRows.get(target)!.get(missing)! });
    }
  };
  bring("clip", "recording", "recording");
  bring("drawing", "recording", "recording");
  bring("category", "parent", "category");

  // A ticked deletion of something still in use stays, and so does the first recording (the project's own video).
  const kept: string[] = [];
  const keep = (op: MergeOp) => {
    ops.splice(ops.indexOf(op), 1);
    kept.push(`${op.kind}:${op.uid}`);
  };
  for (;;) {
    const clips = [...after("clip").values()];
    const drawings = [...after("drawing").values()];
    const categories = [...after("category").values()];
    const inUse = (op: MergeOp): boolean => {
      switch (op.kind) {
        case "category":
          return clips.some(clip => (clip.categories as string[]).includes(op.uid)) ||
            categories.some(cat => cat.parent === op.uid);
        case "player":
          return clips.some(clip => (clip.players as string[]).includes(op.uid));
        case "recording":
          return op.uid === mine.recordings[0]?.uid ||
            [...clips, ...drawings].some(row => row.recording === op.uid);
        default:
          return false;
      }
    };
    const used = ops.find(op => op.op === "delete" && inUse(op));
    if (!used) break;
    keep(used);
  }

  const phase = (op: MergeOp) => PHASES.findIndex(([kind, table]) => kind === op.op && table === op.kind);
  // Parents are inserted before their children and deleted after them.
  const depth = (op: MergeOp) => {
    if (op.kind !== "category") return 0;
    const row = op.op === "insert" ? op.row : mineRows.get("category")!.get(op.uid);
    const child = row?.parent ? 1 : 0;
    return op.op === "delete" ? -child : child;
  };
  ops.sort((a, b) => phase(a) - phase(b) || depth(a) - depth(b));

  return {
    ops,
    kept,
    newRecordings: ops.filter(op => op.op === "insert" && op.kind === "recording").map(op => op.uid),
    clipFiles: ops
      .filter(op => op.kind === "clip" && (op.op === "insert" || (op.op === "update" &&
        ("time" in op.fields || "recording" in op.fields))))
      .map(op => op.uid),
  };
};

type SqlValue = string | number | null;

export interface MergeDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
  };
}

export interface MergeFiles {
  /** Where each recording in `plan.newRecordings` now is. */
  recordingPaths: Map<string, string>;
  /** The cut file a clip in `plan.clipFiles` arrived with; a clip without one waits for a re-cut. */
  clipFiles: Map<string, { output: string; thumbnail: string }>;
}

const TABLES: Record<ItemKind, string> = {
  recording: "project_videos", category: "categories", player: "players", clip: "clips", drawing: "annotations",
};

// The UI offers 1-10 s; database.ts falls back to the global setting outside this range.
const displaySeconds = (value: unknown): number | null =>
  typeof value === "number" && value > 0 && value <= 60 ? value : null;

/**
 * Runs a merge plan on one project and saves the 'received' snapshot, all in
 * one transaction. Returns the cut files of deleted or re-timed clips, for the
 * caller to remove once this has committed.
 */
export const applyMerge = (
  db: MergeDb,
  projectId: number,
  plan: MergePlan,
  files: MergeFiles,
  snapshot: { id: string; data: string } | null,
): { removedFiles: string[] } => {
  // A new player or category with the same name as one here becomes that one.
  const aliases = new Map<string, number>();
  const idOf = (kind: ItemKind, uid: string | null): number | null => {
    if (!uid) return null;
    if (aliases.has(`${kind}:${uid}`)) return aliases.get(`${kind}:${uid}`)!;
    const row = db.prepare(`SELECT id FROM ${TABLES[kind]} WHERE project_id = ? AND uid = ?`).get(projectId, uid);
    return (row as { id: number } | undefined)?.id ?? null;
  };
  const ids = (kind: ItemKind, uids: unknown) => JSON.stringify(
    (uids as string[]).map(uid => idOf(kind, uid)).filter((id): id is number => id !== null));
  const videoPath = (uid: unknown): string => {
    const fromBundle = files.recordingPaths.get(uid as string);
    if (fromBundle) return fromBundle;
    const row = db.prepare("SELECT video_path FROM project_videos WHERE project_id = ? AND uid = ?")
      .get(projectId, uid as string) as { video_path: string } | undefined;
    if (!row) throw new Error(INVALID_INPUT);
    return row.video_path;
  };
  const removedFiles: string[] = [];
  const clipFilesOf = (uid: string) => {
    const row = db.prepare("SELECT output_path, thumbnail_path, overlay_path FROM clips WHERE project_id = ? AND uid = ?")
      .get(projectId, uid) as Record<string, string | null> | undefined;
    for (const file of Object.values(row ?? {})) if (file) removedFiles.push(file);
  };

  const columns = (kind: ItemKind, fields: Fields): Record<string, SqlValue> => {
    const set: Record<string, SqlValue> = {};
    for (const [field, value] of Object.entries(fields)) {
      if (kind === "clip") {
        if (field === "time") [set.start_time, set.end_time, set.duration] = value as number[];
        else if (field === "court") [set.court_x, set.court_y] = (value as number[] | null) ?? [null, null];
        else if (field === "categories") set.categories = ids("category", value);
        else if (field === "players") set.players = ids("player", value);
        else if (field === "recording") set.video_path = videoPath(value);
        else if (field === "notes" || field === "quarter") set[field] = (value as string | null) || null;
        else set[field] = value as SqlValue;
      } else if (kind === "drawing") {
        if (field === "displaySeconds") set.display_seconds = displaySeconds(value);
        else if (field === "pausePlayback") set.pause_playback = value === true ? 1 : 0;
        else if (field === "recording") set.video_path = videoPath(value);
        else set[field] = value as SqlValue;
      } else if (kind === "category") {
        if (field === "parent") set.parent_id = idOf("category", value as string | null);
        else if (field === "description") set.description = (value as string) || null;
        else set[field] = value as SqlValue;
      } else {
        set[field] = value as SqlValue;
      }
    }
    return set;
  };

  const insert = (table: string, set: Record<string, SqlValue>) => {
    const keys = Object.keys(set);
    db.prepare(`INSERT INTO ${table} (${keys.join(", ")}, updated_at) VALUES (${keys.map(() => "?").join(", ")}, CURRENT_TIMESTAMP)`)
      .run(...keys.map(key => set[key]));
  };

  const run = (op: MergeOp) => {
    const table = TABLES[op.kind];
    if (op.op === "delete") {
      if (op.kind === "clip") clipFilesOf(op.uid);
      db.prepare(`DELETE FROM ${table} WHERE project_id = ? AND uid = ?`).run(projectId, op.uid);
      return;
    }
    if (op.op === "update") {
      const set = columns(op.kind, op.fields);
      if (op.kind === "clip" && ("time" in op.fields || "recording" in op.fields)) {
        clipFilesOf(op.uid);
        const file = files.clipFiles.get(op.uid);
        Object.assign(set, {
          output_path: file?.output ?? "", thumbnail_path: file?.thumbnail ?? "", drawings_key: null, overlay_path: null,
        });
      }
      const keys = Object.keys(set);
      db.prepare(`UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND uid = ?`)
        .run(...keys.map(key => set[key]), projectId, op.uid);
      return;
    }

    if (op.kind === "recording") {
      const file = files.recordingPaths.get(op.uid);
      if (!file) throw new Error(INVALID_INPUT);
      db.prepare(`
        INSERT INTO project_videos (project_id, video_path, video_name, uid)
        VALUES (?, ?, ?, ?) ON CONFLICT(project_id, video_path) DO NOTHING
      `).run(projectId, file, path.basename(file), op.uid);
      return;
    }
    const set = columns(op.kind, op.row);
    if (op.kind === "player" || op.kind === "category") {
      const same = op.kind === "player"
        ? db.prepare("SELECT id FROM players WHERE project_id = ? AND name = ?").get(projectId, set.name)
        : db.prepare("SELECT id FROM categories WHERE project_id = ? AND name = ? AND parent_id IS ?")
          .get(projectId, set.name, set.parent_id);
      if (same) {
        aliases.set(`${op.kind}:${op.uid}`, (same as { id: number }).id);
        return;
      }
    }
    if (op.kind === "clip") {
      const file = files.clipFiles.get(op.uid);
      Object.assign(set, { output_path: file?.output ?? "", thumbnail_path: file?.thumbnail ?? "" });
    }
    insert(table, { ...set, project_id: projectId, uid: op.uid });
  };

  db.exec("BEGIN");
  try {
    for (const op of plan.ops) run(op);
    if (snapshot) insertShareSnapshot(db, { ...snapshot, projectId, direction: "received" });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { removedFiles };
};

/** A value as the review screen shows it. */
export type ReviewValue =
  | { type: "text"; text: string }
  | { type: "time"; start: number; end: number }
  | { type: "seconds"; seconds: number | null }
  | { type: "tags"; tags: Array<{ name: string; color: string | null }> }
  | { type: "color"; color: string }
  | { type: "flag"; on: boolean }
  | { type: "status"; status: ParsedSession["clips"][number]["status"] }
  | { type: "court"; set: boolean }
  | { type: "shapes"; count: number }
  | { type: "exists"; exists: boolean };

export interface ReviewField {
  field: string;
  mine: ReviewValue;
  theirs: ReviewValue;
}

export interface ReviewRow {
  token: string;
  kind: ItemKind;
  group: DiffItem["group"];
  ticked: boolean;
  preview: {
    title: string;
    start?: number;
    end?: number;
    tags?: Array<{ name: string; color: string | null }>;
    color?: string;
    detail?: string;
  };
  changes: ReviewField[];
  conflicts: ReviewField[];
  /** For a deletion: how many of my clips use it, so it would stay. */
  inUse: number;
}

export interface ShareReview {
  hasBase: boolean;
  rows: ReviewRow[];
}

const shapeCount = (data: unknown): number => {
  try {
    const shapes: unknown = JSON.parse(data as string);
    return Array.isArray(shapes) ? shapes.length : 0;
  } catch {
    return 0;
  }
};

/** The diff as the renderer sees it: uids as tokens, names instead of ids, no paths. */
export const reviewSummary = (diff: ShareDiff, mine: ParsedSession, theirs: ParsedSession): ShareReview => {
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

  const inUse = (item: DiffItem): number => {
    if (item.group !== "deleted") return 0;
    return mine.clips.filter(clip =>
      (item.kind === "category" && clip.categoryKeys.includes(item.uid)) ||
      (item.kind === "player" && clip.playerKeys.includes(item.uid)) ||
      (item.kind === "recording" && clip.recordingUid === item.uid)).length;
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
      inUse: inUse(item),
    })),
  };
};
