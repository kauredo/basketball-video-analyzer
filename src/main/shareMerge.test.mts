import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { EXISTS, diffSessions, type ShareDiff } from "./shareDiff.ts";
import {
  applyMerge, mergeNeeds, pickBase, planMerge, reviewSummary, validateSelections, type MergeSelections,
} from "./shareMerge.ts";
import { addPermanentIds } from "./permanentIds.ts";
import { migrateProjectVideos } from "./projectVideos.ts";
import { createShareSnapshotsTable, getShareSnapshot, type ShareSnapshot } from "./shareSnapshots.ts";
import type { ParsedSession } from "./sessionData.ts";
import {
  ANA, BEA, C1, C2, C3, C4, C5, CAT, D1, D2, DEFENSE, OFFENSE, PNR, PRESS, R1, R2, baseSession, clip, clipOf, edit, uid,
} from "./shareFixtures.test.mts";

/** Ticks every row the diff ticks by default, with the given picks. */
const defaults = (diff: ShareDiff, choices: Record<string, Record<string, "mine" | "theirs">> = {}): MergeSelections =>
  validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, item.ticked])),
    choices,
  });

const plan = (base: ParsedSession | null, mine: ParsedSession, theirs: ParsedSession,
  pick: (diff: ShareDiff) => MergeSelections = diff => defaults(diff)) => {
  const diff = diffSessions(base, mine, theirs);
  return planMerge(diff, mine, theirs, pick(diff));
};
const opList = (merge: ReturnType<typeof plan>) => merge.ops.map(op => `${op.op} ${op.kind}:${op.uid}`);

test("pickBase: the sent snapshot named by basedOn, only from this project", () => {
  const rows: Record<string, ShareSnapshot> = {
    sent1: { id: "sent1", project_id: 1, direction: "sent", data: "{}", created_at: "" },
    sent2: { id: "sent2", project_id: 2, direction: "sent", data: "{}", created_at: "" },
    got1: { id: "got1", project_id: 1, direction: "received", data: "{}", created_at: "" },
  };
  const get = (id: string) => rows[id] ?? null;
  assert.equal(pickBase({ id: "new", basedOn: "sent1" }, 1, get)?.id, "sent1");
  assert.equal(pickBase({ id: "new", basedOn: "sent2" }, 1, get), null, "another project's snapshot");
  assert.equal(pickBase({ id: "new", basedOn: "got1" }, 1, get), null, "a received snapshot is not a base");
  assert.equal(pickBase({ id: "new", basedOn: null }, 1, get), null);
  assert.equal(pickBase({ id: "new", basedOn: "gone" }, 1, get), null);
  assert.equal(pickBase({ id: "got1", basedOn: "sent1" }, 1, get)?.id, "got1", "a share already received is its own base");
  assert.equal(pickBase({ id: "got1", basedOn: "sent1" }, 2, get), null);
});

test("selections: unknown rows, fields that are not in conflict and bad values are refused", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A"; });
  const theirs = edit(base, s => { clipOf(s, C1).title = "B"; clipOf(s, C2).notes = "n"; });
  const diff = diffSessions(base, mine, theirs);
  const c1 = `clip:${C1}`;
  const ok = validateSelections(diff, { selected: { [c1]: true, [`clip:${C2}`]: false }, choices: { [c1]: { title: "theirs" } } });
  assert.deepEqual([...ok.selected], [c1]);
  assert.equal(ok.choices.get(c1)?.get("title"), "theirs");

  const refused = [
    null, [], { selected: {} }, { choices: {} },
    { selected: { "clip:nope": true }, choices: {} },
    { selected: { [c1]: "yes" }, choices: {} },
    { selected: {}, choices: { [c1]: { title: "both" } } },
    { selected: {}, choices: { [c1]: { notes: "theirs" } } },
    { selected: {}, choices: { [`clip:${C2}`]: { notes: "theirs" } } },
    { selected: {}, choices: { [c1]: "theirs" } },
    JSON.parse(`{"selected":{"__proto__":true},"choices":{}}`),
  ];
  for (const input of refused) assert.throws(() => validateSelections(diff, input), /ERROR_INVALID_INPUT/, JSON.stringify(input));
});

test("plan: only ticked rows become operations", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.clips.push(clip(C5, "Backdoor", 90));
    clipOf(s, C1).title = "Renamed";
  });
  const diff = diffSessions(base, base, theirs);
  const merge = planMerge(diff, base, theirs, validateSelections(diff, { selected: { [`clip:${C5}`]: true }, choices: {} }));
  assert.deepEqual(opList(merge), [`insert clip:${C5}`]);
  assert.deepEqual(merge.clipFiles, [C5]);
});

test("plan: conflict picks are honoured; mine leaves the row alone, their other fields still come", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A"; clipOf(s, C2).title = "A2"; });
  const theirs = edit(base, s => {
    clipOf(s, C1).title = "B";
    clipOf(s, C2).title = "B2";
    clipOf(s, C2).status = "keep";
  });
  const merge = plan(base, mine, theirs, diff => defaults(diff, { [`clip:${C1}`]: { title: "theirs" } }));
  assert.deepEqual(merge.ops, [
    { op: "update", kind: "clip", uid: C1, fields: { title: "B" } },
    { op: "update", kind: "clip", uid: C2, fields: { status: "keep" } },
  ]);
});

test("plan: an unticked deletion is untouched; a ticked one deletes", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  assert.deepEqual(opList(plan(base, base, theirs)), []);
  assert.deepEqual(opList(plan(base, base, theirs, diff =>
    validateSelections(diff, { selected: { [`clip:${C3}`]: true }, choices: {} }))), [`delete clip:${C3}`]);
});

test("plan: a deleted category still used by clips after the merge is kept, and so is its parent", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid === DEFENSE);
    for (const row of s.clips) row.categoryKeys = [];
  });
  const tickAll = (diff: ShareDiff) => validateSelections(diff, {
    selected: Object.fromEntries(diff.items.filter(item => item.kind === "category").map(item => [item.token, true])),
    choices: {},
  });
  // Clip C4 still uses Pick & Roll here; no clip uses Offense, but Pick & Roll sits under it.
  const merge = plan(base, base, theirs, tickAll);
  assert.deepEqual(opList(merge), []);
  assert.deepEqual(merge.kept.sort(), [`category:${OFFENSE}`, `category:${PNR}`].sort());

  // Their clip edits untag everything, so the same ticks now delete both, the child first.
  const all = plan(base, base, theirs);
  const both = plan(base, base, theirs, diff => validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, true])), choices: {},
  }));
  assert.equal(all.ops.filter(op => op.op === "delete").length, 0, "deletions start unticked");
  assert.deepEqual(both.ops.filter(op => op.op === "delete").map(op => op.uid), [PNR, OFFENSE]);
  assert.deepEqual(both.kept, []);
});

test("plan: a parent no clip uses stays while a child it holds stays", () => {
  const base = baseSession();
  const mine = edit(base, s => { for (const row of s.clips) if (row.uid !== C4) row.categoryKeys = []; });
  const theirs = edit(mine, s => {
    s.categories = s.categories.filter(cat => cat.uid === DEFENSE);
    clipOf(s, C4).categoryKeys = [];
  });
  const merge = plan(base, mine, theirs, diff => validateSelections(diff, {
    selected: Object.fromEntries(diff.items.filter(item => item.kind === "category").map(item => [item.token, true])),
    choices: {},
  }));
  assert.deepEqual(opList(merge), []);
  assert.deepEqual(merge.kept.sort(), [`category:${OFFENSE}`, `category:${PNR}`].sort());
});

test("plan: a ticked clip on a new recording brings the recording, even unticked", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    s.clips.push(clip(C5, "Second half", 5, { recording: 1, recordingUid: R2 }));
  });
  const merge = plan(base, base, theirs, diff => validateSelections(diff, { selected: { [`clip:${C5}`]: true }, choices: {} }));
  assert.deepEqual(opList(merge), [`insert recording:${R2}`, `insert clip:${C5}`]);
  assert.deepEqual(merge.newRecordings, [R2]);
});

test("plan: a new subcategory brings its new parent; parents are inserted first", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories.push(
      { uid: uid(14), key: uid(14), parentKey: PRESS, name: "Full court", color: "#123456", description: "" },
      { uid: PRESS, key: PRESS, parentKey: null, name: "Press", color: "#654321", description: "" },
    );
  });
  const merge = plan(base, base, theirs, diff => validateSelections(diff, { selected: { [`category:${uid(14)}`]: true }, choices: {} }));
  assert.deepEqual(opList(merge), [`insert category:${PRESS}`, `insert category:${uid(14)}`]);
});

test("plan: the project's first recording is never deleted", () => {
  const base = baseSession();
  const merge = plan(null, base, edit(base, s => {
    s.recordings = [{ uid: R2, videoName: "other.mp4" }];
    s.clips = [];
    s.drawings = [];
  }), diff => validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, true])),
    choices: Object.fromEntries(diff.items.map(item => [item.token, { [item.conflicts[0].field]: "theirs" }])),
  }));
  assert.ok(merge.kept.includes(`recording:${R1}`));
  assert.ok(!merge.ops.some(op => op.op === "delete" && op.kind === "recording"));
});

test("plan: I deleted, they edited: theirs restores it, mine keeps it deleted", () => {
  const base = baseSession();
  const mine = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const theirs = edit(base, s => { clipOf(s, C3).notes = "look"; });
  assert.deepEqual(opList(plan(base, mine, theirs)), []);
  assert.deepEqual(opList(plan(base, mine, theirs, diff => defaults(diff, { [`clip:${C3}`]: { [EXISTS]: "theirs" } }))),
    [`insert clip:${C3}`]);
});

test("needs: recordings I lack, and clips that are new, restored or moved", () => {
  const base = baseSession();
  const mine = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    s.clips.push(clip(C5, "New", 90));
    clipOf(s, C3).notes = "edited";
    clipOf(s, C1).endTime = 20;
    clipOf(s, C2).title = "Only the title";
  });
  assert.deepEqual(mergeNeeds(diffSessions(base, mine, theirs), mine), { recordings: [R2], clips: [C1, C3, C5] });
});

test("summary: names and colours, no uids except in tokens, and how many clips use a deletion", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid !== DEFENSE);
    clipOf(s, C1).categoryKeys = [OFFENSE, PNR];
    s.players[1].number = "12";
  });
  const review = reviewSummary(diffSessions(base, base, theirs), base, theirs);
  const deleted = review.rows.find(row => row.token === `category:${DEFENSE}`)!;
  assert.equal(deleted.inUse, 1);
  assert.deepEqual(deleted.preview, { title: "Defense", color: "#3b7b9b", detail: undefined });
  const c1 = review.rows.find(row => row.token === `clip:${C1}`)!;
  assert.deepEqual(c1.changes, [{
    field: "categories",
    mine: { type: "tags", tags: [{ name: "Offense", color: "#b15f43" }] },
    theirs: { type: "tags", tags: [{ name: "Offense", color: "#b15f43" }, { name: "Pick & Roll", color: "#a94ebc" }] },
  }]);
  const bea = review.rows.find(row => row.token === `player:${BEA}`)!;
  assert.deepEqual(bea.changes, [{ field: "number", mine: { type: "text", text: "7" }, theirs: { type: "text", text: "12" } }]);
  const text = JSON.stringify(review.rows.map(({ token, ...row }) => row));
  assert.ok(![OFFENSE, PNR, DEFENSE, ANA, BEA, R1, C1].some(id => text.includes(id)), text);
});

// The tables as database.ts creates them, then the permanent-id migration.
const schema = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, video_path TEXT NOT NULL,
      video_name TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_opened DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL,
      description TEXT, parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(name, parent_id, project_id));
    CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, number TEXT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(name, project_id));
    CREATE TABLE clips (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, video_path TEXT NOT NULL,
      output_path TEXT NOT NULL, thumbnail_path TEXT, start_time REAL NOT NULL, end_time REAL NOT NULL,
      duration REAL NOT NULL, title TEXT NOT NULL, categories TEXT NOT NULL, players TEXT DEFAULT '[]', quarter TEXT,
      court_x REAL, court_y REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      drawings_key TEXT, overlay_path TEXT,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE);
    CREATE TABLE annotations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
      video_path TEXT NOT NULL, timestamp REAL NOT NULL, data TEXT NOT NULL, display_seconds REAL,
      pause_playback INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE);
    INSERT INTO projects (name, video_path, video_name) VALUES ('Derby', '/v/game.mp4', 'game.mp4');
  `);
  migrateProjectVideos(db);
  addPermanentIds(db);
  createShareSnapshotsTable(db);
  return db;
};

/** Writes a session's rows into project 1, by uid. Clip files are /clips/<title>.mp4. */
const seed = (db: DatabaseSync, session: ParsedSession) => {
  db.prepare("UPDATE project_videos SET uid = ? WHERE project_id = 1").run(R1);
  const idOf = (table: string, id: string) =>
    (db.prepare(`SELECT id FROM ${table} WHERE uid = ?`).get(id) as { id: number }).id;
  for (const cat of [...session.categories].sort((a, b) => Number(!!a.parentKey) - Number(!!b.parentKey))) {
    db.prepare("INSERT INTO categories (name, color, description, parent_id, project_id, uid) VALUES (?, ?, ?, ?, 1, ?)")
      .run(cat.name, cat.color, cat.description, cat.parentKey ? idOf("categories", cat.parentKey) : null, cat.uid);
  }
  for (const player of session.players) {
    db.prepare("INSERT INTO players (name, number, project_id, uid) VALUES (?, ?, 1, ?)").run(player.name, player.number, player.uid);
  }
  for (const row of session.clips) {
    db.prepare(`INSERT INTO clips (project_id, video_path, output_path, thumbnail_path, start_time, end_time, duration,
      title, categories, players, quarter, notes, status, uid) VALUES (1, '/v/game.mp4', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`/clips/${row.title}.mp4`, `/clips/${row.title}.jpg`, row.startTime, row.endTime, row.duration, row.title,
        JSON.stringify(row.categoryKeys.map(key => idOf("categories", key))),
        JSON.stringify(row.playerKeys.map(key => idOf("players", key))), row.quarter, row.notes, row.status, row.uid);
  }
  for (const drawing of session.drawings) {
    db.prepare("INSERT INTO annotations (project_id, video_path, timestamp, data, uid) VALUES (1, '/v/game.mp4', ?, ?, ?)")
      .run(drawing.timestamp, drawing.data, drawing.uid);
  }
};

const rowOf = (db: DatabaseSync, table: string, id: string) =>
  db.prepare(`SELECT * FROM ${table} WHERE uid = ?`).get(id) as Record<string, unknown> | undefined;
const count = (db: DatabaseSync, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

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
  const merge = plan(base, base, theirs);
  applyMerge(db, 1, merge, { recordingPaths: new Map([[R2, "/v/second.mp4"]]), clipFiles: new Map() }, null);
  assert.equal(rowOf(db, "project_videos", R2)?.video_path, "/v/second.mp4");
  assert.equal(rowOf(db, "project_videos", R2)?.video_name, "second.mp4");
  assert.equal(rowOf(db, "clips", C4)?.video_path, "/v/second.mp4");
  const drawing = rowOf(db, "annotations", D1)!;
  assert.equal(drawing.video_path, "/v/second.mp4");
  assert.equal(drawing.pause_playback, 1);
  assert.equal(drawing.display_seconds, null, "an out-of-range replay time falls back to the setting");
});

test("apply: a new player named like one I have becomes mine instead of failing", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  const theirs = edit(base, s => {
    s.players.push({ uid: CAT, key: CAT, name: "Ana", number: "4" });
    clipOf(s, C1).playerKeys = [CAT];
  });
  applyMerge(db, 1, plan(base, base, theirs), { recordingPaths: new Map(), clipFiles: new Map() }, null);
  assert.equal(count(db, "players"), 2);
  assert.deepEqual(JSON.parse(rowOf(db, "clips", C1)!.players as string), [rowOf(db, "players", ANA)!.id]);
});

test("apply: a failure part way rolls everything back and saves no snapshot", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  const diff = diffSessions(base, mine, theirs);
  const merge = planMerge(diff, mine, theirs, defaults(diff, { [`clip:${C1}`]: { title: "theirs" } }));
  // Last, after every good operation: a clip moved to a recording nobody resolved.
  merge.ops.push({ op: "update", kind: "clip", uid: C4, fields: { recording: R2 } });
  const before = JSON.stringify(["clips", "players", "categories", "annotations"].map(table =>
    db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  assert.throws(() => applyMerge(db, 1, merge, { recordingPaths: new Map(), clipFiles: new Map() },
    { id: "share-b", data: "{}" }), /ERROR_INVALID_INPUT/);
  const after = JSON.stringify(["clips", "players", "categories", "annotations"].map(table =>
    db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  assert.equal(after, before);
  assert.equal(getShareSnapshot(db, "share-b"), null);
});

test("apply: a snapshot that fails takes the rows back out with it", () => {
  const db = schema();
  const { base, mine, theirs } = scenario();
  seed(db, mine);
  db.prepare("INSERT INTO share_snapshots (id, project_id, direction, data) VALUES ('taken', 1, 'sent', '{}')").run();
  const merge = plan(base, mine, theirs);
  assert.throws(() => applyMerge(db, 1, merge, { recordingPaths: new Map(), clipFiles: new Map() }, { id: "taken", data: "{}" }));
  assert.equal(rowOf(db, "clips", C5), undefined);
  assert.equal(rowOf(db, "categories", DEFENSE)?.name, "Defense");
});

test("apply: only this project's rows are touched", () => {
  const db = schema();
  const base = baseSession();
  seed(db, base);
  db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Other', '/v/o.mp4', 'o.mp4')");
  const theirs = edit(base, s => { clipOf(s, C1).title = "B"; });
  const merge = plan(base, base, theirs);
  applyMerge(db, 2, merge, { recordingPaths: new Map(), clipFiles: new Map() }, null);
  assert.equal(rowOf(db, "clips", C1)?.title, "Fast break");

  // A tag whose uid only another project has is dropped, not linked across projects.
  db.prepare("INSERT INTO categories (name, color, project_id, uid) VALUES ('Press', '#123456', 2, ?)").run(PRESS);
  const tagged = edit(base, s => { clipOf(s, C1).categoryKeys = [OFFENSE, PRESS]; });
  applyMerge(db, 1, plan(base, base, tagged), { recordingPaths: new Map(), clipFiles: new Map() }, null);
  assert.deepEqual(JSON.parse(rowOf(db, "clips", C1)!.categories as string), [rowOf(db, "categories", OFFENSE)!.id]);
});
