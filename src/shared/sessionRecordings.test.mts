import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionRecordings } from "./sessionRecordings.ts";

const legacy = { version: 2, project: { name: "Scouting", videoName: "first.mp4" }, categories: [], clips: [] };

test("loads single-video sessions", () => {
  assert.deepEqual(sessionRecordings(legacy), ["first.mp4"]);
});

test("v3 sessions map clip and drawing indices to their recording", () => {
  const session = {
    ...legacy,
    version: 3,
    recordings: [{ videoName: "first.mp4" }, { videoName: "second.mp4" }],
    clips: [{ recording: 1 }],
    drawings: [{ recording: 0, timestamp: 2, data: "[]" }],
  };
  assert.deepEqual(sessionRecordings(session), ["first.mp4", "second.mp4"]);
  assert.throws(() => sessionRecordings({ ...session, clips: [{ recording: 2 }] }), /INVALID_SESSION_FILE/);
  assert.throws(() => sessionRecordings({ ...session, drawings: [{ recording: -1 }] }), /INVALID_SESSION_FILE/);
  assert.throws(() => sessionRecordings({
    ...session, drawings: [{ recording: 0, timestamp: 2, data: "[null]" }],
  }), /INVALID_SESSION_FILE/);
});
