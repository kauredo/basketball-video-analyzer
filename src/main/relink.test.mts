import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { RECORDING_ALREADY_IN_PROJECT, relinkVideoRows } from "./relink.ts";

const database = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, video_path TEXT, video_name TEXT)`);
  db.exec(`CREATE TABLE project_videos (id INTEGER PRIMARY KEY, project_id INTEGER, video_path TEXT,
    video_name TEXT, received_size INTEGER, received_dev TEXT, received_ino TEXT, UNIQUE(project_id, video_path))`);
  db.exec(`CREATE TABLE clips (id INTEGER PRIMARY KEY, project_id INTEGER, video_path TEXT)`);
  db.exec(`CREATE TABLE annotations (id INTEGER PRIMARY KEY, project_id INTEGER, video_path TEXT)`);
  db.exec(`INSERT INTO projects VALUES
    (1, 'Team A', '/old/game.mp4', 'game.mp4'),
    (2, 'Team B', '/old/game.mp4', 'game.mp4'),
    (3, 'Other', '/films/other.mp4', 'other.mp4')`);
  db.exec(`INSERT INTO project_videos VALUES
    (30, 1, '/old/game.mp4', 'game.mp4', 5, '1', '2'),
    (31, 2, '/old/game.mp4', 'game.mp4', NULL, NULL, NULL),
    (32, 3, '/films/other.mp4', 'other.mp4', 5, '1', '3'),
    (33, 3, '/films/second.mp4', 'second.mp4', NULL, NULL, NULL)`);
  db.exec(`INSERT INTO clips VALUES (10, 1, '/old/game.mp4'), (11, 2, '/old/game.mp4'), (12, 3, '/films/other.mp4')`);
  db.exec(`INSERT INTO annotations VALUES (20, 1, '/old/game.mp4'), (21, 3, '/films/other.mp4')`);
  return db;
};

const paths = (db: DatabaseSync, table: string) =>
  db.prepare(`SELECT id, video_path FROM ${table} ORDER BY id`).all().map((row) => [row.id, row.video_path]);

test("relink moves recordings, projects, clips and saved drawings to the new path", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/old/game.mp4", "/new/game.mp4", "game.mp4"), 2);
  assert.deepEqual(paths(db, "project_videos"), [
    [30, "/new/game.mp4"], [31, "/new/game.mp4"], [32, "/films/other.mp4"], [33, "/films/second.mp4"],
  ]);
  assert.deepEqual(paths(db, "projects"), [[1, "/new/game.mp4"], [2, "/new/game.mp4"], [3, "/films/other.mp4"]]);
  assert.deepEqual(paths(db, "clips"), [[10, "/new/game.mp4"], [11, "/new/game.mp4"], [12, "/films/other.mp4"]]);
  assert.deepEqual(paths(db, "annotations"), [[20, "/new/game.mp4"], [21, "/films/other.mp4"]]);
  // The coach picked the new file, so only the untouched received recording keeps its record.
  assert.deepEqual(db.prepare("SELECT id FROM project_videos WHERE received_size IS NOT NULL").all()
    .map((row) => row.id), [32]);
});

test("relink moves a second recording without touching the project's first", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/films/second.mp4", "/new/second.mp4", "second.mp4"), 1);
  assert.deepEqual(paths(db, "project_videos").slice(2), [[32, "/films/other.mp4"], [33, "/new/second.mp4"]]);
  assert.deepEqual(paths(db, "projects")[2], [3, "/films/other.mp4"]);
});

test("relink of an unknown path changes nothing", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/nowhere.mp4", "/new/game.mp4", "game.mp4"), 0);
  assert.equal(paths(db, "clips").filter(([, p]) => p === "/new/game.mp4").length, 0);
});

test("picking a changed received recording at its own path again clears its received record", () => {
  const db = database();
  assert.equal(relinkVideoRows(db, "/films/other.mp4", "/films/other.mp4", "other.mp4"), 1);
  assert.deepEqual(paths(db, "project_videos")[2], [32, "/films/other.mp4"]);
  assert.deepEqual(db.prepare("SELECT id FROM project_videos WHERE received_size IS NOT NULL").all()
    .map((row) => row.id), [30]);
});

test("relink onto a file the project already has is refused before anything moves", () => {
  const db = database();
  assert.throws(() => relinkVideoRows(db, "/films/second.mp4", "/films/other.mp4", "other.mp4"),
    new RegExp(RECORDING_ALREADY_IN_PROJECT));
  assert.deepEqual(paths(db, "project_videos")[3], [33, "/films/second.mp4"]);
});
