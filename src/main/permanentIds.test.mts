import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { EDITED_TABLES, UID_TABLES, addPermanentIds } from "./permanentIds.ts";

const oldDatabase = () => {
  const db = new DatabaseSync(":memory:");
  for (const table of UID_TABLES) {
    db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.exec(`INSERT INTO ${table} (id, name, created_at) VALUES (1, 'a', '2026-01-01 10:00:00'), (2, 'b', '2026-02-01 10:00:00')`);
  }
  return db;
};

const uids = (db: DatabaseSync, table: string) =>
  db.prepare(`SELECT uid FROM ${table} ORDER BY id`).all().map((row) => row.uid);

test("gives every row in every table a distinct uid", () => {
  const db = oldDatabase();
  assert.equal(addPermanentIds(db), UID_TABLES.length * 2);
  const all = UID_TABLES.flatMap((table) => uids(db, table));
  assert.ok(all.every((uid) => typeof uid === "string" && uid.length === 36));
  assert.equal(new Set(all).size, all.length);
});

test("a second run keeps every uid and timestamp", () => {
  const db = oldDatabase();
  addPermanentIds(db);
  const snapshot = () => UID_TABLES.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  const before = snapshot();
  assert.equal(addPermanentIds(db), 0);
  assert.deepEqual(snapshot(), before);
});

test("rows inserted without a uid get one on the next run", () => {
  const db = oldDatabase();
  addPermanentIds(db);
  db.exec("INSERT INTO project_videos (id, name) VALUES (3, 'c')");
  assert.equal(addPermanentIds(db), 1);
  assert.equal(uids(db, "project_videos").filter(Boolean).length, 3);
});

test("every table gets a unique index on uid", () => {
  const db = oldDatabase();
  addPermanentIds(db);
  for (const table of UID_TABLES) {
    const index = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(`idx_${table}_uid`);
    assert.match(String(index?.sql), /CREATE UNIQUE INDEX/, table);
    const [first] = uids(db, table);
    assert.throws(() => db.prepare(`UPDATE ${table} SET uid = ? WHERE id = 2`).run(first as string), table);
  }
});

test("a half-migrated table keeps its uids and gains the index", () => {
  const db = oldDatabase();
  db.exec("ALTER TABLE clips ADD COLUMN uid TEXT");
  db.exec("UPDATE clips SET uid = 'kept-uid' WHERE id = 1");
  assert.equal(addPermanentIds(db), UID_TABLES.length * 2 - 1);
  const [kept, filled] = uids(db, "clips");
  assert.equal(kept, "kept-uid");
  assert.equal(typeof filled, "string");
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'idx_clips_uid'").get());
  const times = db.prepare("SELECT created_at, updated_at FROM clips ORDER BY id").all();
  assert.ok(times.every((row) => row.updated_at === row.created_at));
});

test("a row with no created_at keeps a NULL updated_at", () => {
  const db = oldDatabase();
  db.exec("INSERT INTO players (id, name, created_at) VALUES (3, 'c', NULL)");
  addPermanentIds(db);
  const row = db.prepare("SELECT uid, updated_at FROM players WHERE id = 3").get();
  assert.equal(typeof row?.uid, "string");
  assert.equal(row?.updated_at, null);
});

test("edited tables start with updated_at equal to created_at", () => {
  const db = oldDatabase();
  addPermanentIds(db);
  for (const table of EDITED_TABLES) {
    const rows = db.prepare(`SELECT created_at, updated_at FROM ${table}`).all();
    assert.ok(rows.every((row) => row.updated_at === row.created_at), table);
  }
  const projectColumns = db.prepare("PRAGMA table_info(projects)").all().map((col) => col.name);
  assert.ok(!projectColumns.includes("updated_at"));
});

test("a failure rolls back every table", () => {
  const db = oldDatabase();
  let calls = 0;
  const failing = () => {
    if (++calls > 5) throw new Error("boom");
    return `uid-${calls}`;
  };
  assert.throws(() => addPermanentIds(db, failing), /boom/);
  for (const table of UID_TABLES) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
    assert.ok(!columns.includes("uid"), table);
  }
  db.exec("BEGIN");
  db.exec("ROLLBACK");
});
