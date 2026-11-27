import { randomUUID } from "crypto";

export interface PermanentIdsDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...params: (number | string)[]): unknown[];
    run(...params: (number | string)[]): unknown;
  };
}

export const UID_TABLES = ["projects", "project_videos", "clips", "categories", "players", "annotations"] as const;
export type UidTable = typeof UID_TABLES[number];
export const EDITED_TABLES: readonly UidTable[] = ["clips", "annotations", "categories", "players"];

/**
 * Gives every row a permanent uid and the edited tables an updated_at, which
 * starts as created_at (NULL when created_at is NULL). Returns the rows it gave a uid.
 */
export const addPermanentIds = (db: PermanentIdsDb, newUid: () => string = randomUUID): number => {
  let backfilled = 0;
  db.exec("BEGIN");
  try {
    for (const table of UID_TABLES) {
      const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
        .map((col) => col.name);
      if (!columns.includes("uid")) db.exec(`ALTER TABLE ${table} ADD COLUMN uid TEXT`);
      const addingUpdatedAt = EDITED_TABLES.includes(table) && !columns.includes("updated_at");
      if (addingUpdatedAt) db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME`);

      // A table gaining updated_at touches every row anyway, so its uid goes in the same write.
      const rows = db
        .prepare(`SELECT id, uid FROM ${table}${addingUpdatedAt ? "" : " WHERE uid IS NULL"}`)
        .all() as Array<{ id: number; uid: string | null }>;
      const update = db.prepare(addingUpdatedAt
        ? `UPDATE ${table} SET uid = ?, updated_at = created_at WHERE id = ?`
        : `UPDATE ${table} SET uid = ? WHERE id = ?`);
      for (const row of rows) {
        if (!row.uid) backfilled++;
        update.run(row.uid ?? newUid(), row.id);
      }

      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid)`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return backfilled;
};
