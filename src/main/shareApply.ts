import fs from "fs";
import path from "path";
import { INVALID_INPUT, SHARE_ROWS_TAKEN } from "./shareBundle.ts";
import type { Fields, ItemKind } from "./shareDiff.ts";
import { isInsideDir } from "./insideDir.ts";
import type { MergeOp, MergePlan } from "./shareMerge.ts";
import { insertShareSnapshot } from "./shareSnapshots.ts";

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
 * one transaction. `check` runs first inside it and may refuse by throwing.
 * Returns the cut files of deleted or re-timed clips, for the caller to
 * remove once this has committed.
 */
export const applyMerge = (
  db: MergeDb,
  projectId: number,
  plan: MergePlan,
  files: MergeFiles,
  snapshot: { id: string; data: string } | null,
  check: () => void = () => {},
  afterOps: () => void = () => {},
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
    check();
    for (const op of plan.ops) run(op);
    afterOps();
    if (snapshot) insertShareSnapshot(db, { ...snapshot, projectId, direction: "received" });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    // Names cannot clash after planMerge, so this is a uid or share id another project already has.
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new Error(SHARE_ROWS_TAKEN);
    throw error;
  }
  return { removedFiles };
};

/**
 * Removes a merge's old clip files once it has committed, best effort. A path
 * that does not resolve inside the clips folder is left alone.
 */
export const removeMergedFiles = async (files: string[], clipsDir: string): Promise<string[]> => {
  const dir = await fs.promises.realpath(clipsDir).catch(() => null);
  const removed: string[] = [];
  if (!dir) return removed;
  for (const file of files) {
    const real = await fs.promises.realpath(file).catch(() => null);
    if (!real || !isInsideDir(real, dir)) continue;
    try {
      await fs.promises.rm(real, { force: true });
      removed.push(file);
    } catch (error) {
      console.error("Error removing a merged clip's file:", error);
    }
  }
  return removed;
};
