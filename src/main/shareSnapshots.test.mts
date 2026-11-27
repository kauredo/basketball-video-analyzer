import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  MAX_SNAPSHOTS_PER_PROJECT, createShareSnapshotsTable, getShareSnapshot, latestReceivedSnapshot, saveShareSnapshot,
} from "./shareSnapshots.ts";

const setup = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
  db.exec("INSERT INTO projects (name) VALUES ('A'), ('B')");
  createShareSnapshotsTable(db);
  createShareSnapshotsTable(db);
  return db;
};

const count = (db: DatabaseSync, projectId: number) =>
  (db.prepare("SELECT COUNT(*) AS n FROM share_snapshots WHERE project_id = ?").get(projectId) as { n: number }).n;

test("a sent snapshot is saved and found by its share id", () => {
  const db = setup();
  saveShareSnapshot(db, { id: "s1", projectId: 1, direction: "sent", data: "{\"version\":4}" });
  const row = getShareSnapshot(db, "s1");
  assert.equal(row?.project_id, 1);
  assert.equal(row?.direction, "sent");
  assert.equal(row?.data, "{\"version\":4}");
  assert.equal(getShareSnapshot(db, "nope"), null);
});

test("the latest received snapshot is the newest received row, ignoring sent ones", () => {
  const db = setup();
  assert.equal(latestReceivedSnapshot(db, 1), null);
  saveShareSnapshot(db, { id: "r1", projectId: 1, direction: "received", data: "{}" });
  saveShareSnapshot(db, { id: "r2", projectId: 1, direction: "received", data: "{}" });
  saveShareSnapshot(db, { id: "s1", projectId: 1, direction: "sent", data: "{}" });
  saveShareSnapshot(db, { id: "rB", projectId: 2, direction: "received", data: "{}" });
  assert.equal(latestReceivedSnapshot(db, 1)?.id, "r2");
});

test("only the newest 20 snapshots of a project are kept, and project B is untouched", () => {
  const db = setup();
  saveShareSnapshot(db, { id: "b1", projectId: 2, direction: "sent", data: "{}" });
  for (let n = 0; n < MAX_SNAPSHOTS_PER_PROJECT + 5; n++) {
    saveShareSnapshot(db, { id: `a${n}`, projectId: 1, direction: "sent", data: "{}" });
  }
  assert.equal(MAX_SNAPSHOTS_PER_PROJECT, 20);
  assert.equal(count(db, 1), 20);
  assert.equal(getShareSnapshot(db, "a4"), null);
  assert.ok(getShareSnapshot(db, "a5"));
  assert.ok(getShareSnapshot(db, "a24"));
  assert.equal(count(db, 2), 1);
});

test("a direction other than sent or received is refused, and nothing is left half-saved", () => {
  const db = setup();
  assert.throws(() => saveShareSnapshot(db, { id: "x", projectId: 1, direction: "lost" as "sent", data: "{}" }));
  assert.equal(count(db, 1), 0);
  saveShareSnapshot(db, { id: "y", projectId: 1, direction: "sent", data: "{}" });
  assert.equal(count(db, 1), 1);
});

test("a prune that fails takes the new row back out with it", () => {
  const db = setup();
  const failingPrune = {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      if (sql.includes("DELETE")) throw new Error("disk I/O error");
      return db.prepare(sql);
    },
  };
  assert.throws(() => saveShareSnapshot(failingPrune, { id: "s1", projectId: 1, direction: "sent", data: "{}" }));
  assert.equal(getShareSnapshot(db, "s1"), null);
});

test("deleting a project deletes its snapshots", () => {
  const db = setup();
  saveShareSnapshot(db, { id: "s1", projectId: 1, direction: "sent", data: "{}" });
  saveShareSnapshot(db, { id: "s2", projectId: 2, direction: "sent", data: "{}" });
  db.exec("DELETE FROM projects WHERE id = 1");
  assert.equal(count(db, 1), 0);
  assert.equal(count(db, 2), 1);
});
