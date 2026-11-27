import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { diffSessions, type ShareDiff } from "./shareDiff.ts";
import { planMerge, validateSelections, type MergeSelections } from "./shareMerge.ts";
import { applyMerge, removeMergedFiles } from "./shareApply.ts";
import { runImport } from "./shareImport.ts";
import { sessionFromLocal, type ParsedSession } from "./sessionData.ts";
import { readSessionSource } from "./sessionSource.ts";
import { EDITED_TABLES } from "./permanentIds.ts";
import { getShareSnapshot } from "./shareSnapshots.ts";
import {
  ANA, BEA, C1, C2, C3, C4, C5, CAT, D1, D2, DEFENSE, OFFENSE, PRESS, R1, R2, baseSession, clip, clipOf, edit,
  schema, seed,
} from "./shareFixtures.test.mts";

const dirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-share-apply-")));
after(() => fs.rmSync(dirs, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
  const dir = path.join(dirs, `d${n++}`);
  fs.mkdirSync(dir);
  return dir;
};

const defaults = (diff: ShareDiff, choices: Record<string, Record<string, "mine" | "theirs">> = {}): MergeSelections =>
  validateSelections(diff, { selected: Object.fromEntries(diff.items.map(item => [item.token, item.ticked])), choices });
const plan = (base: ParsedSession | null, mine: ParsedSession, theirs: ParsedSession,
  pick: (diff: ShareDiff) => MergeSelections = diff => defaults(diff)) => {
  const diff = diffSessions(base, mine, theirs);
  return planMerge(diff, mine, theirs, pick(diff));
};
const noFiles = () => ({ recordingPaths: new Map<string, string>(), clipFiles: new Map<string, { output: string; thumbnail: string }>() });

const rowOf = (db: DatabaseSync, table: string, id: string) =>
  db.prepare(`SELECT * FROM ${table} WHERE uid = ?`).get(id) as Record<string, unknown> | undefined;
const count = (db: DatabaseSync, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const dump = (db: DatabaseSync) => JSON.stringify(["clips", "players", "categories", "annotations", "project_videos"]
  .map(table => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
const local = (db: DatabaseSync) => sessionFromLocal(readSessionSource(db, 1)!, (a, b) => a === b);

test("schema guard: the test tables have the columns database.ts gives them", () => {
  const source = fs.readFileSync(new URL("./database.ts", import.meta.url), "utf8");
  const db = schema();
  for (const table of ["clips", "categories", "players", "annotations"]) {
    const create = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\s*\\)\\n`))?.[1];
    assert.ok(create, table);
    const created = create.split("\n").map(line => line.trim().split(/\s+/)[0])
      .filter(word => /^[a-z_]+$/.test(word));
    const added = [...source.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN (\\w+)`, "g"))].map(match => match[1]);
    const permanent = ["uid", ...(EDITED_TABLES as readonly string[]).includes(table) ? ["updated_at"] : []];
    const expected = [...new Set([...created, ...added, ...permanent])].sort();
    const actual = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(col => col.name).sort();
    assert.deepEqual(actual, expected, table);
  }
});

test("the local side, read back the way the app reads it, matches the session it was written from", () => {
  const base = edit(baseSession(), s => {
    clipOf(s, C2).quarter = null;
    clipOf(s, C1).notes = "";
    s.categories[2].description = "";
    s.players[1].number = null;
  });
  const db = schema();
  seed(db, base);
  const mine = local(db);
  assert.equal(rowOf(db, "clips", C1)?.notes, null, "notes are NULL in the row");
  assert.equal(rowOf(db, "categories", DEFENSE)?.description, null);
  assert.equal(rowOf(db, "players", BEA)?.number, null);
  assert.deepEqual(diffSessions(base, mine, base).items, []);
  assert.deepEqual(diffSessions(base, base, mine).items, []);
});

/** The review scenario: A edited clips 1 and 2 and drew; B edited, added, deleted and renamed. */
const scenario = () => {
  const base = baseSession();
  const mine = edit(base, s => {
    clipOf(s, C1).title = "A's title";
    clipOf(s, C2).title = "A's press";
    s.drawings.push({ ...s.drawings[0], uid: D2, timestamp: 32 });
  });
  const theirs = edit(base, s => {
    clipOf(s, C1).title = "B's title";
    clipOf(s, C2).notes = "B's notes";
    s.clips = s.clips.filter(row => row.uid !== C3);
    s.clips.push(clip(C5, "Backdoor", 90, { categoryKeys: [DEFENSE], playerKeys: [BEA, CAT] }));
    s.categories[2].name = "Defence";
    s.players[1].number = "12";
    s.players.push({ uid: CAT, key: CAT, name: "Cat", number: null });
  });
  return { base, mine, theirs };
};

test("apply: the review scenario lands in one transaction with the received snapshot", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  const diff = diffSessions(base, mine, theirs);
  assert.deepEqual(diff.items.map(item => [item.token, item.group]), [
    [`category:${DEFENSE}`, "changed"], [`player:${BEA}`, "changed"], [`player:${CAT}`, "new"],
    [`clip:${C1}`, "conflict"], [`clip:${C2}`, "changed"], [`clip:${C5}`, "new"], [`clip:${C3}`, "deleted"],
  ]);
  const merge = planMerge(diff, mine, theirs, defaults(diff, { [`clip:${C1}`]: { title: "theirs" } }));
  const result = applyMerge(db, 1, merge, {
    recordingPaths: new Map(),
    clipFiles: new Map([[C5, { output: "/clips/new-c5.mp4", thumbnail: "/clips/new-c5.jpg" }]]),
  }, { id: "share-b", data: "{\"version\":4}" });

  assert.deepEqual(result.removedFiles, []);
  assert.equal(rowOf(db, "clips", C1)?.title, "B's title");
  assert.equal(rowOf(db, "clips", C2)?.title, "A's press");
  assert.equal(rowOf(db, "clips", C2)?.notes, "B's notes");
  assert.ok(rowOf(db, "clips", C3), "the unticked deletion leaves clip 3");
  const c5 = rowOf(db, "clips", C5)!;
  assert.equal(c5.output_path, "/clips/new-c5.mp4");
  assert.equal(c5.video_path, "/v/game.mp4");
  const ids = (table: string, uids: string[]) => uids.map(id => rowOf(db, table, id)!.id);
  assert.deepEqual(JSON.parse(c5.players as string), ids("players", [BEA, CAT]));
  assert.deepEqual(JSON.parse(c5.categories as string), ids("categories", [DEFENSE]));
  assert.ok(c5.updated_at);
  assert.ok(rowOf(db, "annotations", D2), "my new drawing stays");
  assert.equal(rowOf(db, "categories", DEFENSE)?.name, "Defence");
  assert.equal(rowOf(db, "players", BEA)?.number, "12");
  const snapshot = getShareSnapshot(db, "share-b");
  assert.equal(snapshot?.direction, "received");
  assert.equal(snapshot?.project_id, 1);
});

test("apply: deleting a clip and moving one in time hands back their old files", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  const theirs = edit(base, s => {
    s.clips = s.clips.filter(row => row.uid !== C3);
    clipOf(s, C1).endTime = 20;
    clipOf(s, C1).duration = 10;
    clipOf(s, C2).startTime = 29;
    clipOf(s, C2).duration = 6;
  });
  const diff = diffSessions(base, base, theirs);
  const merge = planMerge(diff, base, theirs, validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, true])), choices: {},
  }));
  const result = applyMerge(db, 1, merge, {
    recordingPaths: new Map(), clipFiles: new Map([[C1, { output: "/clips/b-c1.mp4", thumbnail: "" }]]),
  }, null);
  assert.deepEqual(result.removedFiles.sort(), [
    "/clips/Fast break.jpg", "/clips/Fast break.mp4", "/clips/Turnover.jpg", "/clips/Turnover.mp4",
    "/clips/Zone press.jpg", "/clips/Zone press.mp4",
  ]);
  assert.equal(rowOf(db, "clips", C3), undefined);
  assert.equal(rowOf(db, "clips", C1)?.output_path, "/clips/b-c1.mp4");
  assert.equal(rowOf(db, "clips", C1)?.end_time, 20);
  assert.equal(rowOf(db, "clips", C2)?.output_path, "", "no bundled file: it waits for a re-cut");
});

test("apply: a new recording and a clip moved onto it use the resolved path", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    Object.assign(clipOf(s, C4), { recording: 1, recordingUid: R2 });
    s.drawings[0].recordingUid = R2;
    s.drawings[0].pausePlayback = true;
    s.drawings[0].displaySeconds = 500;
  });
  applyMerge(db, 1, plan(base, base, theirs), { recordingPaths: new Map([[R2, "/v/second.mp4"]]), clipFiles: new Map() }, null);
  assert.equal(rowOf(db, "project_videos", R2)?.video_path, "/v/second.mp4");
  assert.equal(rowOf(db, "project_videos", R2)?.video_name, "second.mp4");
  assert.equal(rowOf(db, "clips", C4)?.video_path, "/v/second.mp4");
  const drawing = rowOf(db, "annotations", D1)!;
  assert.equal(drawing.video_path, "/v/second.mp4");
  assert.equal(drawing.pause_playback, 1);
  assert.equal(drawing.display_seconds, null, "an out-of-range replay time falls back to the setting");
});

test("apply: the after-ops hook sees the new rows inside the transaction, and its failure rolls them back", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
  });
  const files = { recordingPaths: new Map([[R2, "/v/second.mp4"]]), clipFiles: new Map() };
  let seen: unknown;
  applyMerge(db, 1, plan(base, base, theirs), files, null, () => {}, () => {
    seen = rowOf(db, "project_videos", R2)?.video_path;
  });
  assert.equal(seen, "/v/second.mp4", "the hook runs after the new recording row is written");

  const db2 = schema();
  seed(db2, base);
  const before = dump(db2);
  assert.throws(() => applyMerge(db2, 1, plan(base, base, theirs), files, { id: "share-b", data: "{}" }, () => {}, () => {
    throw new Error("mark failed");
  }), /mark failed/);
  assert.equal(dump(db2), before);
  assert.equal(getShareSnapshot(db2, "share-b"), null);
});

test("apply: a new player named like one I have becomes mine instead of failing", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  const theirs = edit(base, s => {
    s.players.push({ uid: CAT, key: CAT, name: "Ana", number: "4" });
    clipOf(s, C1).playerKeys = [CAT];
  });
  applyMerge(db, 1, plan(base, base, theirs), noFiles(), null);
  assert.equal(count(db, "players"), 2);
  assert.deepEqual(JSON.parse(rowOf(db, "clips", C1)!.players as string), [rowOf(db, "players", ANA)!.id]);
});

test("apply: renames that clash, a swap and a parent loop all apply without a unique index failing", () => {
  const db = schema();
  const base = baseSession();
  const mine = edit(base, s => { s.categories[2].parentKey = OFFENSE; });
  seed(db, mine);
  const theirs = edit(base, s => {
    s.players[0].name = "Bea";
    s.players[1].name = "Ana";
    s.categories[0].parentKey = DEFENSE;
  });
  const merge = plan(base, mine, theirs);
  assert.equal(merge.heldBack.length, 3);
  applyMerge(db, 1, merge, noFiles(), null);
  assert.equal(rowOf(db, "players", ANA)?.name, "Ana");
  assert.equal(rowOf(db, "categories", OFFENSE)?.parent_id, null);
  assert.equal(rowOf(db, "categories", DEFENSE)?.parent_id, rowOf(db, "categories", OFFENSE)?.id);
});

test("apply: a failure part way rolls everything back and saves no snapshot", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  const diff = diffSessions(base, mine, theirs);
  const merge = planMerge(diff, mine, theirs, defaults(diff, { [`clip:${C1}`]: { title: "theirs" } }));
  // Last, after every good operation: a clip moved to a recording nobody resolved.
  merge.ops.push({ op: "update", kind: "clip", uid: C4, fields: { recording: R2 } });
  const before = dump(db);
  assert.throws(() => applyMerge(db, 1, merge, noFiles(), { id: "share-b", data: "{}" }), /ERROR_INVALID_INPUT/);
  assert.equal(dump(db), before);
  assert.equal(getShareSnapshot(db, "share-b"), null);
});

test("apply: a check that refuses inside the transaction leaves everything as it was", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  const before = dump(db);
  assert.throws(() => applyMerge(db, 1, plan(base, mine, theirs), noFiles(), { id: "share-b", data: "{}" }, () => {
    throw new Error("ERROR_REVIEW_STALE");
  }), /ERROR_REVIEW_STALE/);
  assert.equal(dump(db), before);
  assert.equal(getShareSnapshot(db, "share-b"), null);
});

test("apply: a snapshot id or a uid another project has is refused with its own code, and nothing lands", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  db.prepare("INSERT INTO share_snapshots (id, project_id, direction, data) VALUES ('taken', 1, 'sent', '{}')").run();
  const before = dump(db);
  assert.throws(() => applyMerge(db, 1, plan(base, mine, theirs), noFiles(), { id: "taken", data: "{}" }),
    /ERROR_SHARE_ROWS_TAKEN/);
  assert.equal(dump(db), before);

  db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Other', '/v/o.mp4', 'o.mp4')");
  db.prepare("INSERT INTO players (name, project_id, uid) VALUES ('Elsewhere', 2, ?)").run(CAT);
  assert.throws(() => applyMerge(db, 1, plan(base, mine, theirs), noFiles(), null), /ERROR_SHARE_ROWS_TAKEN/);
  assert.equal(rowOf(db, "clips", C5), undefined);
});

test("apply: only this project's rows are touched, and a tag only another project has is dropped", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Other', '/v/o.mp4', 'o.mp4')");
  const theirs = edit(base, s => { clipOf(s, C1).title = "B"; });
  applyMerge(db, 2, plan(base, base, theirs), noFiles(), null);
  assert.equal(rowOf(db, "clips", C1)?.title, "Fast break");

  db.prepare("INSERT INTO categories (name, color, project_id, uid) VALUES ('Press', '#123456', 2, ?)").run(PRESS);
  const tagged = edit(base, s => { clipOf(s, C1).categoryKeys = [OFFENSE, PRESS]; });
  applyMerge(db, 1, plan(base, base, tagged), noFiles(), null);
  assert.deepEqual(JSON.parse(rowOf(db, "clips", C1)!.categories as string), [rowOf(db, "categories", OFFENSE)!.id]);
});

test("old clip files are removed only inside the clips folder", async () => {
  const clips = fresh();
  const outside = fresh();
  const inside = path.join(clips, "a.mp4");
  const away = path.join(outside, "b.mp4");
  const link = path.join(clips, "link.mp4");
  for (const file of [inside, away]) fs.writeFileSync(file, "x");
  fs.symlinkSync(away, link);
  const removed = await removeMergedFiles([inside, away, link, path.join(clips, "..", path.basename(outside), "b.mp4"),
    path.join(clips, "gone.mp4")], clips);
  assert.deepEqual(removed, [inside]);
  assert.ok(!fs.existsSync(inside));
  assert.ok(fs.existsSync(away), "a file outside, by path or through a link, stays");
});

test("runImport leaves a write's removed files in place; only the caller removes them, after the commit", async () => {
  const clips = fresh();
  const old = path.join(clips, "old.mp4");
  fs.writeFileSync(old, "x");
  const signal = new AbortController().signal;
  const result = await runImport({ copies: [], signal, onProgress: () => {}, write: () => ({ removedFiles: [old] }) });
  assert.ok(fs.existsSync(old));
  await removeMergedFiles(result.removedFiles, clips);
  assert.ok(!fs.existsSync(old));

  fs.writeFileSync(old, "x");
  const quiet = console.error;
  console.error = () => {};
  try {
    await assert.rejects(runImport({
      copies: [], signal, onProgress: () => {}, write: () => { throw new Error("ERROR_SHARE_ROWS_TAKEN"); },
    }), /ERROR_SHARE_ROWS_TAKEN/);
  } finally {
    console.error = quiet;
  }
  assert.ok(fs.existsSync(old), "a write that throws touches none of them");
});
