import assert from "node:assert/strict";
import { test } from "node:test";
import { projectPlaybackKey, resumePosition } from "./projectPlayback.ts";

test("shares no playback key between projects", () => {
  assert.notEqual(projectPlaybackKey(1), projectPlaybackKey(2));
});

test("resumes an unfinished video with a valid saved position", () => {
  assert.equal(resumePosition(18.5, 20), 18.5);
  for (const saved of [null, "18", -1, NaN, Infinity, 20, 25]) {
    assert.equal(resumePosition(saved, 20), 0);
  }
});
