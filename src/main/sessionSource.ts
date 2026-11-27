import type { SessionSource } from "./sessionData.ts";

export interface SessionSourceDb {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
}

type Row = Record<string, unknown>;

/**
 * Every row a session of this project is built from, read the way the app
 * reads them. Null when there is no such project.
 */
export const readSessionSource = (db: SessionSourceDb, projectId: number): SessionSource | null => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as SessionSource["project"] | undefined;
  if (!project) return null;
  const drawings = db.prepare(
    "SELECT * FROM annotations WHERE project_id = ? AND video_path = ? ORDER BY timestamp ASC");
  const recordings = db.prepare("SELECT * FROM project_videos WHERE project_id = ? ORDER BY id").all(projectId) as
    SessionSource["recordings"];
  return {
    project,
    recordings: recordings.map(video => ({
      ...video,
      drawings: (drawings.all(projectId, video.video_path) as Row[])
        .map(row => ({ ...row, pause_playback: row.pause_playback === 1 })) as SessionSource["recordings"][number]["drawings"],
    })),
    categories: db.prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY parent_id ASC, name ASC")
      .all(projectId) as SessionSource["categories"],
    players: db.prepare("SELECT * FROM players WHERE project_id = ? ORDER BY name ASC").all(projectId) as
      SessionSource["players"],
    clips: db.prepare("SELECT * FROM clips WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as
      SessionSource["clips"],
  };
};
