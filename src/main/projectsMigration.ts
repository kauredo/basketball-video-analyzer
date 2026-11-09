export interface MigrationDb {
  exec(sql: string): unknown;
  prepare(sql: string): { get(): unknown; all(): unknown[] };
}

const PROJECT_COLUMNS = [
  "id",
  "name",
  "video_path",
  "video_name",
  "description",
  "created_at",
  "last_opened",
];

const NEW_PROJECTS_SQL = `
  CREATE TABLE projects_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    video_path TEXT NOT NULL,
    video_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
  )`;

/** Returns true when it rebuilt the table. */
export const dropProjectsVideoPathUnique = (db: MigrationDb): boolean => {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'")
    .get() as { sql: string } | undefined;
  if (!table || !/unique/i.test(table.sql)) return false;

  const columns = (db.prepare("PRAGMA table_info(projects)").all() as Array<{
    name: string;
  }>).map((col) => col.name);
  const sameColumns =
    columns.length === PROJECT_COLUMNS.length &&
    PROJECT_COLUMNS.every((name) => columns.includes(name));
  if (!sameColumns) {
    console.warn("projects has unexpected columns, keeping UNIQUE on video_path:", columns);
    return false;
  }

  // Dropping the parent table with foreign keys on would cascade-delete every
  // clip, category, player and annotation. The pragma is ignored inside a
  // transaction, so it has to change before BEGIN.
  const { foreign_keys: foreignKeys } = db.prepare("PRAGMA foreign_keys").get() as {
    foreign_keys: number;
  };
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    const danglingBefore = db.prepare("PRAGMA foreign_key_check").all().length;
    const columnList = PROJECT_COLUMNS.join(", ");

    db.exec("BEGIN");
    try {
      db.exec(NEW_PROJECTS_SQL);
      db.exec(`INSERT INTO projects_new (${columnList}) SELECT ${columnList} FROM projects`);
      db.exec("DROP TABLE projects");
      db.exec("ALTER TABLE projects_new RENAME TO projects");
      db.exec("CREATE INDEX IF NOT EXISTS idx_projects_video_path ON projects(video_path)");
      if (db.prepare("PRAGMA foreign_key_check").all().length > danglingBefore) {
        throw new Error("projects rebuild left dangling foreign keys");
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.exec(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
  return true;
};
