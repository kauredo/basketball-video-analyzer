import assert from "node:assert/strict";
import { test } from "node:test";
import { activeRecordingKey, projectPlaybackKey, projectPrefKeys, resumePosition } from "./projectPlayback.ts";

test("shares no playback key between projects or recordings", () => {
  const keys = [projectPlaybackKey(1), projectPlaybackKey(2), projectPlaybackKey(12),
    projectPlaybackKey(1, 2), projectPlaybackKey(1, 5), projectPlaybackKey(1, 6), activeRecordingKey(1)];
  assert.equal(new Set(keys).size, keys.length);
});

test("lists every stored key of a project and none of another's", () => {
  assert.deepEqual(projectPrefKeys(1, [5, 6]), [
    projectPlaybackKey(1), projectPlaybackKey(1, 5), projectPlaybackKey(1, 6), activeRecordingKey(1),
  ]);
  assert.ok(!projectPrefKeys(1, [5]).includes(projectPlaybackKey(2, 5)));
});

test("resumes an unfinished video with a valid saved position", () => {
  assert.equal(resumePosition(18.5, 20), 18.5);
  for (const saved of [null, "18", -1, 0, NaN, Infinity, 20, 25]) {
    assert.equal(resumePosition(saved, 20), 0);
  }
});
