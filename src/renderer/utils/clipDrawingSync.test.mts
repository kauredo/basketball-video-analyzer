import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clipDrawingsKey,
  selectClipAnnotations,
  MAX_CLIP_DRAWINGS,
} from "./clipDrawingSync.ts";

const drawing = (id: number, timestamp: number, extra = {}) => ({
  id,
  project_id: 1,
  video_path: "/game.mp4",
  timestamp,
  data: "[]",
  ...extra,
});

test("picks drawings inside the clip and one still showing at mark-in", () => {
  const picked = selectClipAnnotations(
    [
      drawing(1, 12),
      drawing(2, 8), // up until 11 with the 3s default
      drawing(3, 8, { pause_playback: true }), // its pause happened before the clip
      drawing(4, 6), // gone by 9
      drawing(5, 15), // at mark-out
    ],
    10,
    15,
    3
  );
  assert.deepEqual(picked.map(a => a.id), [2, 1]);
});

test("the key changes with timing and pause, not with order", () => {
  const a = drawing(1, 11);
  const b = drawing(2, 12, { display_seconds: 5 });
  const key = clipDrawingsKey(selectClipAnnotations([b, a], 10, 15, 3), 3);
  assert.equal(key, "1:3:0,2:5:0");
  assert.equal(clipDrawingsKey(selectClipAnnotations([a, b], 10, 15, 3), 3), key);
  assert.notEqual(clipDrawingsKey([a, b], 4), key);
  assert.notEqual(clipDrawingsKey([a, { ...b, pause_playback: true }], 3), key);
});

test("no drawings is the empty key", () => {
  assert.equal(clipDrawingsKey(selectClipAnnotations([drawing(1, 30)], 10, 15, 3), 3), "");
});

test("caps at the same count main enforces", () => {
  const many = Array.from({ length: 30 }, (_, i) => drawing(i, 10 + i * 0.1));
  assert.equal(selectClipAnnotations(many, 10, 15, 3).length, MAX_CLIP_DRAWINGS);
});
