import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { relinkVideoRows } from "./relink.ts";

const database = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, video_path TEXT, video_name TEXT)`);
  db.exec(`CREATE TABLE clips (id INTEGER PRIMARY KEY, project_id INTEGER, video_path TEXT)`);
  db.exec(`CREATE TABLE annotations (id INTEGER PRIMARY KEY, project_id INTEGER, video_path TEXT)`);
  db.exec(`INSERT INTO projects VALUES
    (1, 'Team A', '/old/game.mp4', 'game.mp4'),
    (2, 'Team B', '/old/game.mp4', 'game.mp4'),
    (3, 'Other', '/films/other.mp4', 'other.mp4')`);
  db.exec(`INSERT INTO clips VALUES (10, 1, '/old/game.mp4'), (11, 2, '/old/game.mp4'), (12, 3, '/films/other.mp4')`);
  db.exec(`INSERT INTO annotations VALUES (20, 1, '/old/game.mp4'), (21, 3, '/films/other.mp4')`);
  return db;
};

const paths = (db: DatabaseSync, table: string) =>
  db.prepare(`SELECT id, video_path FROM ${table} ORDER BY id`).all().map((row) => [row.id, row.video_path]);

test("relink moves projects, clips and saved drawings to the new path", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/old/game.mp4", "/new/game.mp4", "game.mp4"), 2);
  assert.deepEqual(paths(db, "projects"), [[1, "/new/game.mp4"], [2, "/new/game.mp4"], [3, "/films/other.mp4"]]);
  assert.deepEqual(paths(db, "clips"), [[10, "/new/game.mp4"], [11, "/new/game.mp4"], [12, "/films/other.mp4"]]);
  assert.deepEqual(paths(db, "annotations"), [[20, "/new/game.mp4"], [21, "/films/other.mp4"]]);
});

test("relink of an unknown path changes nothing", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/nowhere.mp4", "/new/game.mp4", "game.mp4"), 0);
  assert.equal(paths(db, "clips").filter(([, p]) => p === "/new/game.mp4").length, 0);
});
