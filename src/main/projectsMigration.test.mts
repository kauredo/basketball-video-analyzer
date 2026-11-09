import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { dropProjectsVideoPathUnique } from "./projectsMigration.ts";

const OLD_PROJECTS_SQL = `
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    video_path TEXT NOT NULL UNIQUE,
    video_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_opened DATETIME DEFAULT CURRENT_TIMESTAMP
  )`;

const oldDatabase = (projectsSql = OLD_PROJECTS_SQL) => {
  const db = new DatabaseSync(":memory:");
  db.exec(projectsSql);
  db.exec(`CREATE TABLE clips (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT
  )`);
  db.exec(`INSERT INTO projects (id, name, video_path, video_name, description, created_at, last_opened)
    VALUES (3, 'Team A', '/films/game.mp4', 'game.mp4', 'first', '2026-01-01 10:00:00', '2026-01-02 10:00:00'),
           (7, 'Other', '/films/other.mp4', 'other.mp4', NULL, '2026-02-01 10:00:00', '2026-02-02 10:00:00')`);
  db.exec("INSERT INTO clips (id, project_id, title) VALUES (1, 3, 'pick and roll'), (2, 7, 'zone')");
  return db;
};

const projects = (db: DatabaseSync) =>
  db.prepare("SELECT * FROM projects ORDER BY id").all().map((row) => ({ ...row }));

test("two projects can share a video after the rebuild", () => {
  const db = oldDatabase();
  assert.throws(() =>
    db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Team B', '/films/game.mp4', 'game.mp4')"),
  );
  assert.equal(dropProjectsVideoPathUnique(db), true);
  db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Team B', '/films/game.mp4', 'game.mp4')");
  const shared = db.prepare("SELECT name FROM projects WHERE video_path = '/films/game.mp4'").all();
  assert.deepEqual(shared.map((row) => row.name).sort(), ["Team A", "Team B"]);
});

test("ids and every column survive", () => {
  const db = oldDatabase();
  const before = projects(db);
  dropProjectsVideoPathUnique(db);
  assert.deepEqual(projects(db), before);
});

test("clips survive and still cascade from their project", () => {
  const db = oldDatabase();
  dropProjectsVideoPathUnique(db);
  const clips = db.prepare("SELECT id, project_id FROM clips ORDER BY id").all().map((row) => ({ ...row }));
  assert.deepEqual(clips, [
    { id: 1, project_id: 3 },
    { id: 2, project_id: 7 },
  ]);
  db.exec("DELETE FROM projects WHERE id = 3");
  assert.deepEqual(db.prepare("SELECT id FROM clips").all().map((row) => row.id), [2]);
});

test("foreign keys are back on afterwards", () => {
  const db = oldDatabase();
  dropProjectsVideoPathUnique(db);
  assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);
});

test("keeps the video_path index", () => {
  const db = oldDatabase();
  dropProjectsVideoPathUnique(db);
  const index = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_projects_video_path'")
    .get();
  assert.ok(index);
});

test("a second run does nothing", () => {
  const db = oldDatabase();
  dropProjectsVideoPathUnique(db);
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name='projects'").get()?.sql;
  assert.equal(dropProjectsVideoPathUnique(db), false);
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name='projects'").get()?.sql, sql);
});

test("does nothing without a projects table", () => {
  const db = new DatabaseSync(":memory:");
  assert.equal(dropProjectsVideoPathUnique(db), false);
});

test("leaves a projects table with unexpected columns alone", () => {
  const db = oldDatabase(OLD_PROJECTS_SQL.replace("last_opened DATETIME", "colour TEXT, last_opened DATETIME"));
  assert.equal(dropProjectsVideoPathUnique(db), false);
  const columns = db.prepare("PRAGMA table_info(projects)").all().map((col) => col.name);
  assert.ok(columns.includes("colour"));
});

test("an orphan row that was already there does not block the rebuild", () => {
  const db = oldDatabase();
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("INSERT INTO clips (id, project_id, title) VALUES (9, 99, 'orphan')");
  db.exec("PRAGMA foreign_keys = ON");
  assert.equal(dropProjectsVideoPathUnique(db), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM clips").get()?.n, 3);
});
