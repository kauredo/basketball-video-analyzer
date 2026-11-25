import assert from "node:assert/strict";
import { test } from "node:test";
import { isSamePath } from "./clipDrawings.ts";
import {
  MAX_SESSION_RECORDINGS, clipRecording, importedClipPath, sessionRecordings,
} from "./sessionRecordings.ts";

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

test("loads single-video sessions as one recording", () => {
  assert.deepEqual(sessionRecordings(legacy), ["first.mp4"]);
  const v1 = { version: 1, project: { name: "Old" }, categories: [], clips: [clip] };
  assert.deepEqual(sessionRecordings(v1), [""]);
});

test("rejects unknown versions", () => {
  for (const version of [undefined, 0, 4, "3"]) rejects({ ...v3, version });
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

test("imports clips onto the picked file for their recording", () => {
  const paths = ["/first.mp4", "/second.mp4"];
  assert.equal(importedClipPath(3, paths, 1), "/second.mp4");
  assert.equal(importedClipPath(2, paths, undefined), "/first.mp4");
  assert.equal(importedClipPath(1, paths, 1), "/first.mp4");
});
