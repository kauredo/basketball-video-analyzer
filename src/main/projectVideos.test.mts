import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  findReceivedInPlace, insertProjectVideo, listProjectVideos, markReceivedInPlace, migrateProjectVideos,
} from "./projectVideos.ts";

test("backfills once, lets projects share a file and isolates each project's recordings", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY, video_path TEXT, video_name TEXT);
    INSERT INTO projects VALUES (1, '/shared.mp4', 'shared'), (2, '/shared.mp4', 'shared');
  `);
  migrateProjectVideos(db);
  migrateProjectVideos(db);
  assert.deepEqual(listProjectVideos(db, 1).map(video => video.video_path), ["/shared.mp4"]);
  const added = insertProjectVideo(db, 1, "/second.mp4", "second");
  assert.equal(insertProjectVideo(db, 1, "/second.mp4", "same file").id, added.id);
  assert.deepEqual(listProjectVideos(db, 1).map(video => video.video_path), ["/shared.mp4", "/second.mp4"]);
  assert.deepEqual(listProjectVideos(db, 2).map(video => video.video_path), ["/shared.mp4"]);
  assert.throws(() => insertProjectVideo(db, 3, "/second.mp4", "second"));
  db.exec("DELETE FROM projects WHERE id = 1");
  assert.equal(listProjectVideos(db, 1).length, 0);
  assert.equal(listProjectVideos(db, 2).length, 1);
});

test("a new recording gets a fresh uid unless one is given", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE projects (id INTEGER PRIMARY KEY, video_path TEXT, video_name TEXT)");
  migrateProjectVideos(db);
  db.exec("INSERT INTO projects VALUES (1, '/a.mp4', 'a')");
  const first = insertProjectVideo(db, 1, "/b.mp4", "b");
  const second = insertProjectVideo(db, 1, "/c.mp4", "c");
  assert.match(first.uid, /^[0-9a-f-]{36}$/);
  assert.notEqual(first.uid, second.uid);
  assert.equal(insertProjectVideo(db, 1, "/d.mp4", "d", "kept-uid").uid, "kept-uid");
});

test("an existing database gains the received columns, and only a marked recording has a record", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY, video_path TEXT, video_name TEXT);
    INSERT INTO projects VALUES (1, '/a.mp4', 'a'), (2, '/a.mp4', 'a');
    CREATE TABLE project_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, video_path TEXT NOT NULL,
      video_name TEXT NOT NULL, uid TEXT, UNIQUE(project_id, video_path));
    INSERT INTO project_videos (project_id, video_path, video_name) VALUES (1, '/a.mp4', 'a');
  `);
  migrateProjectVideos(db);
  migrateProjectVideos(db);
  insertProjectVideo(db, 1, "/shared/game.mp4", "game");
  assert.equal(findReceivedInPlace(db, "/a.mp4"), null);
  assert.equal(findReceivedInPlace(db, "/shared/game.mp4"), null);

  markReceivedInPlace(db, 1, "/shared/game.mp4", { size: 24, dev: "16777232", ino: "18446744073709551615" });
  assert.deepEqual({ ...findReceivedInPlace(db, "/shared/game.mp4") },
    { size: 24, dev: "16777232", ino: "18446744073709551615" });
  assert.equal(findReceivedInPlace(db, "/a.mp4"), null);
});
