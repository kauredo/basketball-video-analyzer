import { randomUUID } from "crypto";

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
