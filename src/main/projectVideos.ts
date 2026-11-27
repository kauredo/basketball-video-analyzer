import { randomUUID } from "crypto";
import type { ReceivedInPlace } from "./bundleFiles.ts";

export interface ProjectVideo {
  id: number;
  uid: string;
  project_id: number;
  video_path: string;
  video_name: string;
}

interface ProjectVideosDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: (number | string)[]): { changes: number | bigint };
    all(...params: (number | string)[]): unknown[];
  };
}

export const migrateProjectVideos = (db: ProjectVideosDb): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      video_path TEXT NOT NULL,
      video_name TEXT NOT NULL,
      uid TEXT,
      UNIQUE(project_id, video_path)
    );

    INSERT OR IGNORE INTO project_videos (project_id, video_path, video_name)
      SELECT id, video_path, video_name FROM projects;
  `);
  // Set only for a recording used in place from a received folder.
  const columns = (db.prepare("PRAGMA table_info(project_videos)").all() as Array<{ name: string }>)
    .map(column => column.name);
  if (!columns.includes("received_size")) db.exec("ALTER TABLE project_videos ADD COLUMN received_size INTEGER");
  if (!columns.includes("received_dev")) db.exec("ALTER TABLE project_videos ADD COLUMN received_dev TEXT");
  if (!columns.includes("received_ino")) db.exec("ALTER TABLE project_videos ADD COLUMN received_ino TEXT");
};

export const markReceivedInPlace = (
  db: ProjectVideosDb, projectId: number, videoPath: string, file: ReceivedInPlace,
): void => {
  db.prepare(`
    UPDATE project_videos SET received_size = ?, received_dev = ?, received_ino = ?
    WHERE project_id = ? AND video_path = ?
  `).run(file.size, file.dev, file.ino, projectId, videoPath);
};

/** What a received recording at this path was, or null when no project uses it in place. */
export const findReceivedInPlace = (db: ProjectVideosDb, videoPath: string): ReceivedInPlace | null => {
  const row = db.prepare(`
    SELECT received_size AS size, received_dev AS dev, received_ino AS ino FROM project_videos
    WHERE video_path = ? AND received_size IS NOT NULL LIMIT 1
  `).all(videoPath)[0] as ReceivedInPlace | undefined;
  return row ?? null;
};

export const listProjectVideos = (db: ProjectVideosDb, projectId: number): ProjectVideo[] =>
  db.prepare("SELECT * FROM project_videos WHERE project_id = ? ORDER BY id")
    .all(projectId) as ProjectVideo[];

export const insertProjectVideo = (
  db: ProjectVideosDb, projectId: number, videoPath: string, videoName: string, uid: string = randomUUID(),
): ProjectVideo => {
  db.prepare(`
    INSERT INTO project_videos (project_id, video_path, video_name, uid)
    VALUES (?, ?, ?, ?) ON CONFLICT(project_id, video_path) DO NOTHING
  `).run(projectId, videoPath, videoName, uid);
  return db.prepare("SELECT * FROM project_videos WHERE project_id = ? AND video_path = ?")
    .all(projectId, videoPath)[0] as ProjectVideo;
};
