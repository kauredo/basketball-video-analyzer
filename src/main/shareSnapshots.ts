/** Snapshots kept per project. Older ones are pruned on each save. */
export const MAX_SNAPSHOTS_PER_PROJECT = 20;

export type ShareDirection = "sent" | "received";

export interface ShareSnapshot {
  /** The share uid written into the .bvap's `share.id`. */
  id: string;
  project_id: number;
  direction: ShareDirection;
  /** The session v4 JSON as shared, without the bundle block. */
  data: string;
  created_at: string;
}

export interface ShareSnapshotsDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: (number | string)[]): unknown;
    get(...params: (number | string)[]): unknown;
  };
}

/**
 * One row per share, sent or received, so a project shared with two coaches
 * keeps a base for each of them.
 */
export const createShareSnapshotsTable = (db: ShareSnapshotsDb): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS share_snapshots (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK(direction IN ('sent', 'received')),
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_share_snapshots_project_id ON share_snapshots(project_id);
  `);
};

export interface NewShareSnapshot {
  id: string;
  projectId: number;
  direction: ShareDirection;
  data: string;
}

/**
 * Inserts a snapshot and prunes the project's oldest beyond the cap, with no
 * transaction of its own: for use inside a caller's transaction.
 */
export const insertShareSnapshot = (db: ShareSnapshotsDb, snapshot: NewShareSnapshot): void => {
  db.prepare("INSERT INTO share_snapshots (id, project_id, direction, data) VALUES (?, ?, ?, ?)")
    .run(snapshot.id, snapshot.projectId, snapshot.direction, snapshot.data);
  // rowid follows insertion order; created_at only has whole seconds.
  db.prepare(`
    DELETE FROM share_snapshots WHERE project_id = ? AND rowid NOT IN (
      SELECT rowid FROM share_snapshots WHERE project_id = ? ORDER BY rowid DESC LIMIT ?
    )
  `).run(snapshot.projectId, snapshot.projectId, MAX_SNAPSHOTS_PER_PROJECT);
};

/** insertShareSnapshot in a transaction of its own. */
export const saveShareSnapshot = (db: ShareSnapshotsDb, snapshot: NewShareSnapshot): void => {
  db.exec("BEGIN");
  try {
    insertShareSnapshot(db, snapshot);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

export const getShareSnapshot = (db: ShareSnapshotsDb, id: string): ShareSnapshot | null =>
  (db.prepare("SELECT * FROM share_snapshots WHERE id = ?").get(id) as ShareSnapshot | undefined) ?? null;

/** The last share this project came in with, which the next share names as `basedOn`. */
export const latestReceivedSnapshot = (db: ShareSnapshotsDb, projectId: number): ShareSnapshot | null =>
  (db.prepare(
    "SELECT * FROM share_snapshots WHERE project_id = ? AND direction = 'received' ORDER BY rowid DESC LIMIT 1",
  ).get(projectId) as ShareSnapshot | undefined) ?? null;
