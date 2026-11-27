import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { isSamePath } from "../shared/clipDrawings.ts";
import {
  MAX_NAME_LENGTH, MAX_NOTES_LENGTH, MAX_SESSION_CATEGORIES, MAX_SESSION_CLIPS, MAX_SESSION_DRAWINGS,
  MAX_SESSION_PLAYERS, MAX_SESSION_RECORDINGS,
  buildSession, clipRecording, parseSession, prepareImport, sessionRecordings, withoutUids, writeSession,
} from "./sessionData.ts";

// The shapes save-session wrote: v1 at 02e0aaf, v2 at d9a7aa6, v3 at 1b1aac6.
const v1 = {
  version: 1,
  exportedAt: "2025-10-01T10:00:00.000Z",
  project: { name: "Lions", videoName: "game.mp4", description: "" },
  categories: [
    { name: "Offense", color: "#FF5722", description: "Offensive plays and actions", parentName: null },
    { name: "Pick & Roll", color: "#FF7043", description: "", parentName: "Offense" },
  ],
  clips: [{ title: "Hedge", startTime: 4, endTime: 9, duration: 5, categories: ["Pick & Roll", "Unknown"], notes: "" }],
};
const v2 = {
  ...v1,
  version: 2,
  players: [{ name: "Ana", number: "7" }, { name: "Bea", number: "" }],
  clips: [
    { ...v1.clips[0], players: ["Ana"], quarter: "Q1" },
    { title: "Drop", startTime: 20, endTime: 26, duration: 6, categories: [], players: [], quarter: null, notes: "slow" },
  ],
};
const v3 = {
  ...v2,
  version: 3,
  recordings: [{ videoName: "game.mp4" }, { videoName: "second-half.mp4" }],
  drawings: [{ recording: 1, timestamp: 2, data: "[]", displaySeconds: null, pausePlayback: false }],
  clips: v2.clips.map((clip, recording) => ({ recording, ...clip, courtX: null, courtY: null, status: null })),
};

const clip = v1.clips[0];
const rejects = (session: unknown) => assert.throws(() => sessionRecordings(session), /INVALID_SESSION_FILE/);
const parses = (session: unknown) => parseSession(JSON.stringify(session));
const refuses = (session: unknown) => assert.throws(() => parses(session), /INVALID_SESSION_FILE/);

const parsedCategories = [
  { uid: null, key: "Offense", parentKey: null, name: "Offense", color: "#FF5722", description: "Offensive plays and actions" },
  { uid: null, key: "Pick & Roll", parentKey: "Offense", name: "Pick & Roll", color: "#FF7043", description: "" },
];
const parsedClip = {
  uid: null, recording: 0, recordingUid: null, categoryKeys: ["Pick & Roll", "Unknown"], playerKeys: [],
  title: "Hedge", startTime: 4, endTime: 9, duration: 5,
  quarter: null, notes: "", courtX: null, courtY: null, status: null,
};

test("a v1 file parses field by field", () => {
  assert.deepEqual(parses(v1), {
    version: 1,
    project: { uid: null, name: "Lions", description: "" },
    recordings: [{ uid: null, videoName: "game.mp4" }],
    categories: parsedCategories,
    players: [],
    clips: [parsedClip],
    drawings: [],
  });
});

test("a v2 file parses field by field", () => {
  assert.deepEqual(parses(v2), {
    version: 2,
    project: { uid: null, name: "Lions", description: "" },
    recordings: [{ uid: null, videoName: "game.mp4" }],
    categories: parsedCategories,
    players: [
      { uid: null, key: "Ana", name: "Ana", number: "7" },
      { uid: null, key: "Bea", name: "Bea", number: null },
    ],
    clips: [
      { ...parsedClip, playerKeys: ["Ana"], quarter: "Q1" },
      { ...parsedClip, categoryKeys: [], title: "Drop", startTime: 20, endTime: 26, duration: 6, notes: "slow" },
    ],
    drawings: [],
  });
});

test("a v3 file parses field by field", () => {
  assert.deepEqual(parses(v3), {
    version: 3,
    project: { uid: null, name: "Lions", description: "" },
    recordings: [{ uid: null, videoName: "game.mp4" }, { uid: null, videoName: "second-half.mp4" }],
    categories: parsedCategories,
    players: [
      { uid: null, key: "Ana", name: "Ana", number: "7" },
      { uid: null, key: "Bea", name: "Bea", number: null },
    ],
    clips: [
      { ...parsedClip, playerKeys: ["Ana"], quarter: "Q1" },
      { ...parsedClip, recording: 1, categoryKeys: [], title: "Drop", startTime: 20, endTime: 26, duration: 6, notes: "slow" },
    ],
    drawings: [{ uid: null, recording: 1, recordingUid: null, timestamp: 2, data: "[]", displaySeconds: null, pausePlayback: false }],
  });
});

test("v1 and v2 clips go on the one recording and carry no drawings", () => {
  const session = parses({ ...v2, clips: [{ ...v2.clips[0], recording: 1 }], drawings: [{}] });
  assert.equal(session.clips[0].recording, 0);
  assert.deepEqual(session.drawings, []);
});

test("loads single-video sessions as one recording", () => {
  assert.deepEqual(sessionRecordings(v2), ["game.mp4"]);
  assert.deepEqual(sessionRecordings({ version: 1, project: { name: "Old" }, categories: [], clips: [clip] }), [""]);
});

test("rejects unknown versions", () => {
  for (const version of [undefined, 0, 5, "3"]) rejects({ ...v3, version });
});

test("v3 sessions map clip and drawing indices to their recording", () => {
  assert.deepEqual(sessionRecordings(v3), ["game.mp4", "second-half.mp4"]);
  rejects({ ...v3, clips: [{ ...clip, recording: 2 }] });
  rejects({ ...v3, clips: [{ ...clip, recording: 0.5 }] });
  rejects({ ...v3, drawings: [{ recording: -1, timestamp: 2, data: "[]" }] });
  rejects({ ...v3, drawings: [{ recording: 0, timestamp: -1, data: "[]" }] });
  rejects({ ...v3, drawings: [{ recording: 0, timestamp: 2, data: "[null]" }] });
  rejects({ ...v3, recordings: [] });
  rejects({ ...v3, recordings: [{ videoName: " " }] });
  rejects({ ...v3, drawings: undefined });
});

test("caps the recordings a session can ask for", () => {
  const recordings = Array.from({ length: MAX_SESSION_RECORDINGS + 1 }, (_, i) => ({ videoName: `${i}.mp4` }));
  rejects({ ...v3, recordings });
  assert.equal(sessionRecordings({ ...v3, recordings: recordings.slice(1) }).length, MAX_SESSION_RECORDINGS);
});

test("caps every list a session holds", () => {
  const filled = (row: unknown, length: number) => Array.from({ length }, () => row);
  const cases: Array<[string, unknown, number]> = [
    ["clips", { ...clip, recording: 0 }, MAX_SESSION_CLIPS],
    ["drawings", v3.drawings[0], MAX_SESSION_DRAWINGS],
    ["categories", v1.categories[0], MAX_SESSION_CATEGORIES],
    ["players", v2.players[0], MAX_SESSION_PLAYERS],
  ];
  for (const [key, row, max] of cases) {
    assert.doesNotThrow(() => sessionRecordings({ ...v3, [key]: filled(row, max) }), key);
    rejects({ ...v3, [key]: filled(row, max + 1) });
  }
});

test("caps the length of names, titles and notes", () => {
  const long = (length: number) => "x".repeat(length);
  const atCap = long(MAX_NAME_LENGTH);
  const over = long(MAX_NAME_LENGTH + 1);
  assert.doesNotThrow(() => sessionRecordings({ ...v3, clips: [{ ...clip, recording: 0, title: atCap, notes: long(MAX_NOTES_LENGTH) }] }));
  rejects({ ...v3, clips: [{ ...clip, recording: 0, title: over }] });
  rejects({ ...v3, clips: [{ ...clip, recording: 0, notes: long(MAX_NOTES_LENGTH + 1) }] });
  rejects({ ...v3, project: { ...v3.project, name: over } });
  rejects({ ...v3, project: { ...v3.project, description: long(MAX_NOTES_LENGTH + 1) } });
  rejects({ ...v2, project: { ...v2.project, videoName: over } });
  rejects({ ...v3, recordings: [{ videoName: over }, v3.recordings[1]] });
  assert.doesNotThrow(() => sessionRecordings({ ...v3, recordings: [{ videoName: atCap }, v3.recordings[1]] }));
  rejects({ ...v3, categories: [{ ...v1.categories[0], name: over }] });
  rejects({ ...v3, categories: [{ ...v1.categories[0], description: long(MAX_NOTES_LENGTH + 1) }] });
  rejects({ ...v3, players: [{ name: over }] });
});

test("category colours must be hex", () => {
  assert.doesNotThrow(() => sessionRecordings({ ...v3, categories: [{ ...v1.categories[0], color: "#abc" }] }));
  for (const color of ["red", "#12345", "#1234567", "#GGGGGG", "url(x)", "#FF5722;x"]) {
    rejects({ ...v3, categories: [{ ...v1.categories[0], color }] });
  }
});

test("accepts every drawing tool and rejects malformed shapes", () => {
  const base = { id: "a", color: "#fff", widthFrac: 0.01 };
  const shapes = [
    { ...base, tool: "pen", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    { ...base, tool: "text", text: "5", at: { x: 0.5, y: 0.5 }, fontFrac: 0.05 },
    ...["line", "arrow", "rect", "ellipse"].map(tool => ({ ...base, tool, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })),
  ];
  const withShapes = (data: unknown) => ({ ...v3, drawings: [{ recording: 0, timestamp: 2, data }] });
  assert.doesNotThrow(() => sessionRecordings(withShapes(JSON.stringify(shapes))));
  for (const bad of [{ ...shapes[0], widthFrac: 0 }, { ...shapes[0], tool: "star" }, { ...shapes[2], to: { x: "1", y: 1 } }]) {
    rejects(withShapes(JSON.stringify([bad])));
  }
  rejects(withShapes("{not json"));
  rejects(withShapes([]));
});

test("rejects clips, categories and players a project could not hold", () => {
  for (const bad of [
    { startTime: "x" }, { startTime: -1 }, { endTime: 4 }, { endTime: Infinity }, { duration: null },
    { title: 7 }, { categories: "Offense" }, { categories: [1] }, { players: [{}] }, { quarter: 1 }, { notes: {} },
  ]) {
    rejects({ ...v2, clips: [{ ...clip, ...bad }] });
  }
  rejects({ ...v2, categories: [{ name: "Offense" }] });
  rejects({ ...v2, players: [{ name: 7 }] });
  rejects({ ...v2, project: { name: "Lions", description: 3 } });
});

test("exports each clip against the recording it was cut from", () => {
  const recordings = ["C:\\games\\first.mp4", "C:\\games\\second.mp4"];
  assert.equal(clipRecording(recordings, "C:/games/second.mp4", isSamePath), 1);
  assert.throws(() => clipRecording(recordings, "C:\\games\\third.mp4", isSamePath), /INVALID_SESSION_FILE/);
});

test("refuses a file that is not JSON", () => {
  assert.throws(() => parseSession("{not json"), /INVALID_SESSION_FILE/);
});

/** A store that hands out ids in order and records what was written. */
const fakeStore = () => {
  let nextId = 1;
  const calls: Record<string, Array<{ row: Record<string, unknown>; uid?: unknown; id: number }>> = {};
  const create = (kind: string) => (row: Record<string, unknown>, uid?: unknown) => {
    const id = nextId++;
    (calls[kind] ??= []).push({ row, uid, id });
    return { ...row, id };
  };
  const store = {
    createProject: create("project"),
    addProjectVideo: (projectId: number, videoPath: string, videoName: string, uid?: string) =>
      create("recording")({ project_id: projectId, video_path: videoPath, video_name: videoName }, uid),
    createCategory: create("category"),
    createPlayer: create("player"),
    createClip: create("clip"),
    createAnnotation: create("drawing"),
  };
  return { store, calls };
};

test("a v3 clip naming a category used under two parents goes to the last one, as before", () => {
  const session = parses({
    ...v3,
    categories: [
      { name: "Offense", color: "#B15F43", parentName: null },
      { name: "Defense", color: "#4075BF", parentName: null },
      { name: "Pick & Roll", color: "#A94EBC", parentName: "Offense" },
      { name: "Pick & Roll", color: "#1C9C71", parentName: "Defense" },
    ],
    clips: [{ ...v3.clips[0], categories: ["Pick & Roll"] }],
  });
  const { store, calls } = fakeStore();
  writeSession(session, ["/game.mp4", "/second-half.mp4"], store as never);
  const [, defenseId] = calls.category.map(call => call.id).slice(0, 2);
  const picks = calls.category.slice(2);
  assert.deepEqual(picks.map(call => call.row.parent_id), [calls.category[0].id, defenseId]);
  assert.equal(calls.clip[0].row.categories, JSON.stringify([picks[1].id]));
});

test("a child listed before its parent still gets that parent", () => {
  const session = parses({ ...v3, categories: [...v1.categories].reverse() });
  const { store, calls } = fakeStore();
  writeSession(session, ["/game.mp4", "/second-half.mp4"], store as never);
  const [offense, pick] = calls.category;
  assert.deepEqual([offense.row.name, pick.row.name], ["Offense", "Pick & Roll"]);
  assert.equal(pick.row.parent_id, offense.id);
});

test("writing a v3 file passes no uids, so every row gets a fresh one", () => {
  const { store, calls } = fakeStore();
  writeSession(parses(v3), ["/game.mp4", "/second-half.mp4"], store as never);
  assert.deepEqual(calls.project[0].uid, { uid: undefined, recordingUid: undefined });
  for (const kind of ["recording", "category", "player", "clip", "drawing"]) {
    assert.ok(calls[kind].every(call => call.uid === undefined), kind);
  }
  assert.equal(calls.clip[1].row.video_path, "/second-half.mp4");
  assert.equal(calls.drawing[0].row.video_path, "/second-half.mp4");
});

test("a clip that arrived with its cut file keeps it; one without keeps an empty path", () => {
  const { store, calls } = fakeStore();
  writeSession(parses(v3), ["/game.mp4", "/second-half.mp4"], store as never,
    [{ output: "/clips/a.mp4", thumbnail: "/clips/a-thumb.jpg" }, null]);
  assert.deepEqual(calls.clip.map(call => [call.row.output_path, call.row.thumbnail_path]),
    [["/clips/a.mp4", "/clips/a-thumb.jpg"], ["", ""]]);
});

const source = () => {
  const project = { id: 1, uid: randomUUID(), name: "Scouting", video_path: "/a.mp4", video_name: "a.mp4" };
  const recordings = [
    { id: 1, uid: randomUUID(), project_id: 1, video_path: "/a.mp4", video_name: "a.mp4", drawings: [] as object[] },
    { id: 2, uid: randomUUID(), project_id: 1, video_path: "/b.mp4", video_name: "b.mp4", drawings: [] as object[] },
  ];
  recordings[1].drawings.push({
    id: 5, uid: randomUUID(), project_id: 1, video_path: "/b.mp4", timestamp: 3, data: "[]",
    display_seconds: 4, pause_playback: true,
  });
  const category = (id: number, name: string, parent_id: number | null = null) =>
    ({ id, uid: randomUUID(), name, color: "#0B7972", project_id: 1, parent_id });
  const categories = [
    category(1, "Offense"), category(2, "Defense"),
    category(3, "Pick & Roll", 1), category(4, "Pick & Roll", 2),
  ];
  const players = [{ id: 7, uid: randomUUID(), name: "Ana", number: "7", project_id: 1 }];
  const clips = [{
    id: 9, uid: randomUUID(), project_id: 1, video_path: "/b.mp4", output_path: "/clips/9.mp4",
    start_time: 1, end_time: 4, duration: 3, title: "Hedge", categories: "[4, 99]", players: "[7, 98]",
    quarter: "Q2", notes: "late", court_x: 0.2, court_y: 0.8, status: "review" as const,
  }];
  return { project, recordings, categories, players, clips };
};

test("a v4 session round-trips its uids and links", () => {
  const rows = source();
  const built = buildSession(rows, isSamePath, "2026-11-27T00:00:00.000Z");
  assert.equal(built.version, 4);
  const session = parseSession(JSON.stringify(built));

  assert.equal(session.project.uid, rows.project.uid);
  assert.deepEqual(session.recordings.map(video => video.uid), rows.recordings.map(video => video.uid));
  assert.deepEqual(session.players.map(player => player.uid), [rows.players[0].uid]);
  assert.deepEqual(session.categories.map(cat => cat.uid),
    [rows.categories[0].uid, rows.categories[2].uid, rows.categories[1].uid, rows.categories[3].uid]);
  assert.equal(session.categories[1].parentKey, rows.categories[0].uid);

  const [loaded] = session.clips;
  assert.equal(loaded.uid, rows.clips[0].uid);
  assert.equal(loaded.recording, 1);
  assert.equal(loaded.recordingUid, rows.recordings[1].uid);
  assert.deepEqual(loaded.categoryKeys, [rows.categories[3].uid]);
  assert.deepEqual(loaded.playerKeys, [rows.players[0].uid]);
  assert.deepEqual(
    { title: loaded.title, quarter: loaded.quarter, notes: loaded.notes, status: loaded.status, courtX: loaded.courtX },
    { title: "Hedge", quarter: "Q2", notes: "late", status: "review", courtX: 0.2 },
  );
  assert.deepEqual(session.drawings, [{
    uid: (rows.recordings[1].drawings[0] as { uid: string }).uid,
    recording: 1, recordingUid: rows.recordings[1].uid,
    timestamp: 3, data: "[]", displaySeconds: 4, pausePlayback: true,
  }]);
});

test("writing a v4 file keeps its uids", () => {
  const rows = source();
  const session = parseSession(JSON.stringify(buildSession(rows, isSamePath)));
  const { store, calls } = fakeStore();
  writeSession(session, ["/a.mp4", "/b.mp4"], store as never);
  assert.deepEqual(calls.project[0].uid, { uid: rows.project.uid, recordingUid: rows.recordings[0].uid });
  assert.equal(calls.recording[0].uid, rows.recordings[1].uid);
  assert.equal(calls.clip[0].uid, rows.clips[0].uid);
  assert.equal(calls.drawing[0].uid, (rows.recordings[1].drawings[0] as { uid: string }).uid);
  assert.deepEqual(new Set(calls.category.map(call => call.uid)), new Set(rows.categories.map(cat => cat.uid)));
});

test("categories with the same name under different parents stay separate", () => {
  const rows = source();
  const session = parseSession(JSON.stringify(buildSession(rows, isSamePath)));
  const picks = session.categories.filter(cat => cat.name === "Pick & Roll");
  assert.equal(new Set(picks.map(cat => cat.key)).size, 2);
  assert.deepEqual(picks.map(cat => cat.parentKey), [rows.categories[0].uid, rows.categories[1].uid]);
  assert.deepEqual(session.clips[0].categoryKeys, [picks[1].key]);
});

test("uids are lowercased when parsed and when built", () => {
  const rows = source();
  rows.project.uid = rows.project.uid.toUpperCase();
  const built = buildSession(rows, isSamePath);
  assert.equal(built.project.uid, rows.project.uid.toLowerCase());

  const shouted = JSON.parse(JSON.stringify(built));
  shouted.clips[0].uid = shouted.clips[0].uid.toUpperCase();
  shouted.clips[0].categoryUids = shouted.clips[0].categoryUids.map((uid: string) => uid.toUpperCase());
  shouted.clips[0].recordingUid = shouted.clips[0].recordingUid.toUpperCase();
  const session = parses(shouted);
  assert.equal(session.clips[0].uid, built.clips[0].uid);
  assert.deepEqual(session.clips[0].categoryKeys, built.clips[0].categoryUids);
  refuses({ ...shouted, clips: [shouted.clips[0], { ...shouted.clips[0], uid: built.clips[0].uid }] });
});

test("the builder refuses a row without a uid", () => {
  const cases: Array<(rows: ReturnType<typeof source>) => void> = [
    rows => { rows.project.uid = ""; },
    rows => { rows.recordings[0].uid = undefined as never; },
    rows => { (rows.recordings[1].drawings[0] as { uid?: string }).uid = undefined; },
    rows => { rows.categories[0].uid = null as never; },
    rows => { rows.players[0].uid = ""; },
    rows => { rows.clips[0].uid = undefined as never; },
  ];
  for (const breakRow of cases) {
    const rows = source();
    breakRow(rows);
    assert.throws(() => buildSession(rows, isSamePath), /SESSION_ROW_WITHOUT_UID/);
  }
});

test("refuses a newer version", () => {
  refuses({ ...buildSession(source(), isSamePath), version: 5 });
});

test("refuses a v4 file whose links point at nothing", () => {
  const built = buildSession(source(), isSamePath);
  const [first] = built.clips;
  refuses({ ...built, clips: [{ ...first, categoryUids: [randomUUID()] }] });
  refuses({ ...built, clips: [{ ...first, playerUids: [randomUUID()] }] });
  refuses({ ...built, clips: [{ ...first, recordingUid: randomUUID() }] });
  refuses({ ...built, drawings: [{ ...built.drawings[0], recordingUid: randomUUID() }] });
  refuses({ ...built, categories: [{ ...built.categories[0], parentUid: randomUUID() }, ...built.categories.slice(1)] });
  refuses({ ...built, categories: [...built.categories].reverse() });
});

test("refuses a v4 file whose recording index and uid disagree", () => {
  const built = buildSession(source(), isSamePath);
  const [firstUid, secondUid] = built.recordings.map(video => video.uid);
  refuses({ ...built, clips: [{ ...built.clips[0], recording: 0, recordingUid: secondUid }] });
  refuses({ ...built, drawings: [{ ...built.drawings[0], recording: 1, recordingUid: firstUid }] });
});

test("refuses a v4 file with a missing or repeated uid", () => {
  const built = buildSession(source(), isSamePath);
  refuses({ ...built, project: { ...built.project, uid: undefined } });
  refuses({ ...built, project: { ...built.project, uid: "not-a-uid" } });
  refuses({ ...built, players: undefined });
  refuses({ ...built, clips: [built.clips[0], built.clips[0]] });
  refuses({ ...built, recordings: [built.recordings[0], built.recordings[0]] });
  refuses({ ...built, categories: [built.categories[0], built.categories[0]] });
});

test("the builder leaves out categories and players a clip no longer has", () => {
  const [exported] = buildSession(source(), isSamePath).clips;
  assert.deepEqual(exported.categories, ["Pick & Roll"]);
  assert.deepEqual(exported.players, ["Ana"]);
  assert.equal(exported.categoryUids.length, 1);
  assert.equal(exported.playerUids.length, 1);
});

test("a copy drops every uid but keeps the links", () => {
  const session = parseSession(JSON.stringify(buildSession(source(), isSamePath)));
  const copy = withoutUids(session);
  const all = [copy.project, ...copy.recordings, ...copy.categories, ...copy.players, ...copy.clips, ...copy.drawings];
  assert.ok(all.every(row => row.uid === null));
  assert.ok([...copy.clips, ...copy.drawings].every(row => row.recordingUid === null));
  assert.deepEqual(copy.clips[0].categoryKeys, session.clips[0].categoryKeys);
  assert.deepEqual(copy.categories.map(cat => cat.key), session.categories.map(cat => cat.key));
});

test("the first import of a v4 file keeps its uids", () => {
  const session = parseSession(JSON.stringify(buildSession(source(), isSamePath)));
  const asked: string[] = [];
  const prepared = prepareImport(session, (table) => { asked.push(table); return false; });
  assert.equal(prepared, session);
  assert.deepEqual(asked.sort(), ["annotations", "categories", "clips", "players", "project_videos", "projects"]);
});

test("a v4 file whose project is already here imports as a copy", () => {
  const session = parseSession(JSON.stringify(buildSession(source(), isSamePath)));
  const prepared = prepareImport(session, (table, uids) => table === "projects" && uids.includes(session.project.uid!));
  assert.equal(prepared.project.uid, null);
  assert.ok(prepared.clips.every(row => row.uid === null));
});

test("a v4 file with only one clip already here imports as a copy", () => {
  const session = parseSession(JSON.stringify(buildSession(source(), isSamePath)));
  const clipUid = session.clips[0].uid!;
  const prepared = prepareImport(session, (table, uids) => table === "clips" && uids.includes(clipUid));
  assert.equal(prepared.project.uid, null);
  assert.ok(prepared.categories.every(row => row.uid === null));
});

test("a v3 file never asks which uids exist and gets fresh uids", () => {
  const session = parses(v3);
  const prepared = prepareImport(session, () => assert.fail("asked about a file without uids"));
  assert.ok([prepared.project, ...prepared.clips, ...prepared.categories].every(row => row.uid === null));
});
