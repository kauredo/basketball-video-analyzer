import { randomUUID } from "crypto";

export interface PermanentIdsDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...params: (number | string)[]): unknown[];
    run(...params: (number | string)[]): unknown;
  };
}

export const UID_TABLES = ["projects", "project_videos", "clips", "categories", "players", "annotations"];
export const EDITED_TABLES = ["clips", "annotations", "categories", "players"];

/** Gives every row a permanent uid and the edited tables an updated_at. Returns the rows it gave a uid. */
export const addPermanentIds = (db: PermanentIdsDb, newUid: () => string = randomUUID): number => {
  let backfilled = 0;
  db.exec("BEGIN");
  try {
    for (const table of UID_TABLES) {
      const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
        .map((col) => col.name);
      if (!columns.includes("uid")) db.exec(`ALTER TABLE ${table} ADD COLUMN uid TEXT`);
      if (EDITED_TABLES.includes(table) && !columns.includes("updated_at")) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME`);
        db.exec(`UPDATE ${table} SET updated_at = created_at`);
      }

      const missing = db.prepare(`SELECT id FROM ${table} WHERE uid IS NULL`).all() as Array<{ id: number }>;
      const setUid = db.prepare(`UPDATE ${table} SET uid = ? WHERE id = ?`);
      for (const { id } of missing) setUid.run(newUid(), id);
      backfilled += missing.length;

      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid)`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return backfilled;
};
