export interface RelinkDb {
  prepare(sql: string): {
    run(...params: string[]): { changes: number | bigint };
    all(...params: string[]): unknown[];
  };
}

export const RECORDING_ALREADY_IN_PROJECT = "ERROR_RECORDING_ALREADY_IN_PROJECT";

/**
 * Moves recordings, projects, clips and saved drawings to the new path. Returns the number of
 * recordings moved. Throws RECORDING_ALREADY_IN_PROJECT when a project holds both paths.
 */
export const relinkVideoRows = (
  db: RelinkDb,
  oldVideoPath: string,
  newVideoPath: string,
  newVideoName: string,
): number => {
  const clash = db.prepare(`
    SELECT 1 FROM project_videos moving JOIN project_videos kept ON moving.project_id = kept.project_id
    WHERE moving.video_path = ? AND kept.video_path = ? LIMIT 1
  `).all(oldVideoPath, newVideoPath);
  if (clash.length > 0) throw new Error(RECORDING_ALREADY_IN_PROJECT);
  const { changes } = db
    .prepare("UPDATE project_videos SET video_path = ?, video_name = ? WHERE video_path = ?")
    .run(newVideoPath, newVideoName, oldVideoPath);
  db.prepare("UPDATE projects SET video_path = ?, video_name = ? WHERE video_path = ?")
    .run(newVideoPath, newVideoName, oldVideoPath);
  db.prepare("UPDATE clips SET video_path = ? WHERE video_path = ?").run(newVideoPath, oldVideoPath);
  db.prepare("UPDATE annotations SET video_path = ? WHERE video_path = ?").run(newVideoPath, oldVideoPath);
  return Number(changes);
};
