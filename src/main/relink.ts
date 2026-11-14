export interface RelinkDb {
  prepare(sql: string): { run(...params: string[]): { changes: number | bigint } };
}

/** Moves projects, clips and saved drawings to the new path. Returns the number of projects moved. */
export const relinkVideoRows = (
  db: RelinkDb,
  oldVideoPath: string,
  newVideoPath: string,
  newVideoName: string,
): number => {
  const { changes } = db
    .prepare("UPDATE projects SET video_path = ?, video_name = ? WHERE video_path = ?")
    .run(newVideoPath, newVideoName, oldVideoPath);
  db.prepare("UPDATE clips SET video_path = ? WHERE video_path = ?").run(newVideoPath, oldVideoPath);
  db.prepare("UPDATE annotations SET video_path = ? WHERE video_path = ?").run(newVideoPath, oldVideoPath);
  return Number(changes);
};
