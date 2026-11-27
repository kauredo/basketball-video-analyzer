import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { isSamePath } from "../shared/clipDrawings.ts";
import {
  MAX_SESSION_RECORDINGS, buildSession, clipRecording, parseSession, sessionRecordings, withoutUids,
} from "./sessionData.ts";

const clip = { title: "Pick and roll", startTime: 4, endTime: 9, duration: 5, categories: ["Offense"], notes: "" };
const legacy = {
  version: 2,
  project: { name: "Scouting", videoName: "first.mp4", description: "" },
  categories: [{ name: "Offense", color: "#0B7972", description: "", parentName: null }],
  players: [{ name: "Ana", number: "7" }],
  clips: [{ ...clip, players: ["Ana"], quarter: "Q1" }],
};
const v3 = {
  ...legacy,
  version: 3,
  recordings: [{ videoName: "first.mp4" }, { videoName: "second.mp4" }],
  clips: [{ ...clip, recording: 1 }],
  drawings: [{ recording: 0, timestamp: 2, data: "[]" }],
};
const rejects = (session: unknown) => assert.throws(() => sessionRecordings(session), /INVALID_SESSION_FILE/);
const parses = (session: unknown) => parseSession(JSON.stringify(session));
const refuses = (session: unknown) => assert.throws(() => parses(session), /INVALID_SESSION_FILE/);

test("loads single-video sessions as one recording", () => {
  assert.deepEqual(sessionRecordings(legacy), ["first.mp4"]);
  const v1 = { version: 1, project: { name: "Old" }, categories: [], clips: [clip] };
  assert.deepEqual(sessionRecordings(v1), [""]);
});

test("rejects unknown versions", () => {
  for (const version of [undefined, 0, 5, "3"]) rejects({ ...v3, version });
});

test("v3 sessions map clip and drawing indices to their recording", () => {
  assert.deepEqual(sessionRecordings(v3), ["first.mp4", "second.mp4"]);
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
    rejects({ ...legacy, clips: [{ ...clip, ...bad }] });
  }
  rejects({ ...legacy, categories: [{ name: "Offense" }] });
  rejects({ ...legacy, players: [{ name: 7 }] });
  rejects({ ...legacy, project: { name: "Scouting", description: 3 } });
});

test("exports each clip against the recording it was cut from", () => {
  const recordings = ["C:\\games\\first.mp4", "C:\\games\\second.mp4"];
  assert.equal(clipRecording(recordings, "C:/games/second.mp4", isSamePath), 1);
  assert.throws(() => clipRecording(recordings, "C:\\games\\third.mp4", isSamePath), /INVALID_SESSION_FILE/);
});

test("refuses a file that is not JSON", () => {
  assert.throws(() => parseSession("{not json"), /INVALID_SESSION_FILE/);
});

test("a v3 file loads by name and index, with no uids", () => {
  const session = parses({
    ...v3,
    categories: [...v3.categories, { name: "Pick", color: "#111111", parentName: "Offense" }],
    players: [{ name: "Ana", number: 7 }, { name: "Bea" }],
    clips: [{ ...clip, recording: 1, players: ["Ana"], courtX: 0.5, courtY: "x", status: "keep" }],
    drawings: [{ recording: 0, timestamp: 2, data: "[]", displaySeconds: 3, pausePlayback: true }],
  });
  assert.deepEqual(session, {
    version: 3,
    project: { uid: null, name: "Scouting", description: "" },
    recordings: [{ uid: null, videoName: "first.mp4" }, { uid: null, videoName: "second.mp4" }],
    categories: [
      { uid: null, key: "Offense", parentKey: null, name: "Offense", color: "#0B7972", description: "" },
      { uid: null, key: "Pick", parentKey: "Offense", name: "Pick", color: "#111111", description: "" },
    ],
    players: [
      { uid: null, key: "Ana", name: "Ana", number: "7" },
      { uid: null, key: "Bea", name: "Bea", number: null },
    ],
    clips: [{
      uid: null, recording: 1, categoryKeys: ["Offense"], playerKeys: ["Ana"],
      title: "Pick and roll", startTime: 4, endTime: 9, duration: 5,
      quarter: null, notes: "", courtX: 0.5, courtY: null, status: "keep",
    }],
    drawings: [{ uid: null, recording: 0, timestamp: 2, data: "[]", displaySeconds: 3, pausePlayback: true }],
  });
});

test("v1 and v2 clips go on the one recording and carry no drawings", () => {
  const session = parses({ ...legacy, clips: [{ ...legacy.clips[0], recording: 1 }], drawings: [{}] });
  assert.equal(session.clips[0].recording, 0);
  assert.deepEqual(session.drawings, []);
  assert.deepEqual(parses({ version: 1, project: { name: "Old" }, categories: [], clips: [clip] }).players, []);
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
  assert.deepEqual(loaded.categoryKeys, [rows.categories[3].uid]);
  assert.deepEqual(loaded.playerKeys, [rows.players[0].uid]);
  assert.deepEqual(
    { title: loaded.title, quarter: loaded.quarter, notes: loaded.notes, status: loaded.status, courtX: loaded.courtX },
    { title: "Hedge", quarter: "Q2", notes: "late", status: "review", courtX: 0.2 },
  );
  assert.deepEqual(session.drawings, [{
    uid: (rows.recordings[1].drawings[0] as { uid: string }).uid,
    recording: 1, timestamp: 3, data: "[]", displaySeconds: 4, pausePlayback: true,
  }]);
});

test("categories with the same name under different parents stay separate", () => {
  const rows = source();
  const session = parseSession(JSON.stringify(buildSession(rows, isSamePath)));
  const picks = session.categories.filter(cat => cat.name === "Pick & Roll");
  assert.equal(new Set(picks.map(cat => cat.key)).size, 2);
  assert.deepEqual(picks.map(cat => cat.parentKey), [rows.categories[0].uid, rows.categories[1].uid]);
  assert.deepEqual(session.clips[0].categoryKeys, [picks[1].key]);
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
  assert.deepEqual(copy.clips[0].categoryKeys, session.clips[0].categoryKeys);
  assert.deepEqual(copy.categories.map(cat => cat.key), session.categories.map(cat => cat.key));
});
