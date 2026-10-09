import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDrawingGraph,
  isSamePath,
  savedDrawingsKey,
  selectClipDrawings,
  selectSavedDrawings,
  MAX_CLIP_DRAWINGS,
} from "./clipDrawings.ts";

const loops = (filters: string[]) =>
  filters
    .map(f => /loop=loop=(\d+):size=1:start=(\d+)/.exec(f))
    .filter(m => m !== null)
    .map(m => ({ frames: Number(m[1]), start: Number(m[2]) }));

const windows = (filters: string[]) =>
  filters
    .map(f => /enable='gte\(t,([\d.]+)\)\*lt\(t,([\d.]+)\)'/.exec(f))
    .filter(m => m !== null)
    .map(m => [Number(m[1]), Number(m[2])]);

test("no pauses: no re-timing, source audio kept", () => {
  const g = buildDrawingGraph(5, [{ start: 1, seconds: 2, pause: false }], 1, true);
  assert.equal(g.addedSeconds, 0);
  assert.ok(!g.filters.some(f => f.includes("fps=")));
  assert.equal(g.audioMap, "0:a?");
  assert.deepEqual(windows(g.filters), [[1, 3]]);
});

test("pauses on the same frame hold for the longer one", () => {
  const g = buildDrawingGraph(
    5,
    [
      { start: 2, seconds: 1, pause: true },
      { start: 2, seconds: 3, pause: true },
    ],
    1,
    true
  );
  assert.deepEqual(loops(g.filters), [{ frames: 90, start: 60 }]);
  assert.equal(g.addedSeconds, 3);
  assert.deepEqual(windows(g.filters), [[2, 5], [2, 5]]);
});

test("a second freeze starts after the frames the first one added", () => {
  const g = buildDrawingGraph(
    6,
    [
      { start: 1, seconds: 1, pause: true },
      { start: 3, seconds: 2, pause: true },
    ],
    1,
    true
  );
  assert.deepEqual(loops(g.filters), [
    { frames: 30, start: 30 },
    { frames: 60, start: 90 + 30 },
  ]);
  assert.equal(g.addedSeconds, 3);
  // Second drawing shows from source 3 s, which is output 4 s, for 2 s.
  assert.deepEqual(windows(g.filters)[1], [4, 6]);
});

test("a drawing that spans a freeze stays up through it", () => {
  const g = buildDrawingGraph(
    6,
    [
      { start: 1, seconds: 3, pause: false },
      { start: 2, seconds: 2, pause: true },
    ],
    1,
    true
  );
  // Source window 1-4 s, with 2 s frozen at 2 s: output 1-6 s.
  assert.deepEqual(windows(g.filters)[0], [1, 6]);
});

test("a pause on the last frame is clamped onto it", () => {
  const g = buildDrawingGraph(2, [{ start: 1.999, seconds: 1, pause: true }], 1, true);
  assert.deepEqual(loops(g.filters), [{ frames: 30, start: 59 }]);
});

test("freezes without a known audio track drop the audio", () => {
  const g = buildDrawingGraph(4, [{ start: 1, seconds: 1, pause: true }], 1, false);
  assert.equal(g.audioMap, null);
});

test("freezes splice silence into the audio", () => {
  const g = buildDrawingGraph(4, [{ start: 1, seconds: 2, pause: true }], 1, true);
  assert.equal(g.audioMap, "[aout]");
  assert.ok(g.filters.some(f => f.startsWith("aevalsrc=0:c=stereo:s=44100:d=2")));
  assert.ok(g.filters.some(f => f.includes("concat=n=3:v=0:a=1")));
});

test("the extra overlay goes on last, over the whole clip", () => {
  const g = buildDrawingGraph(4, [{ start: 1, seconds: 1, pause: false }], 1, true, 2);
  assert.equal(g.filters.at(-1), "[d0][2:v]overlay=0:0[still]");
  assert.equal(g.videoOut, "still");
});

test("selection follows replay rules and the cap", () => {
  const picked = selectClipDrawings(10, 5, [
    { timestamp: 8, seconds: 3, pause: false }, // on screen at mark-in
    { timestamp: 8, seconds: 1, pause: false }, // gone before mark-in
    { timestamp: 9, seconds: 3, pause: true }, // pause playback never reaches
    { timestamp: 12, seconds: NaN, pause: false },
    { timestamp: 12, seconds: 61, pause: false },
    { timestamp: 15, seconds: 1, pause: false }, // at mark-out
    { timestamp: 12, seconds: 1, pause: true },
  ]);
  assert.deepEqual(
    picked.map(d => [d.start, d.pause]),
    [
      [-2, false],
      [2, true],
    ]
  );

  const many = Array.from({ length: 30 }, (_, i) => ({
    timestamp: 10 + i * 0.1,
    seconds: 1,
    pause: false,
  }));
  assert.equal(selectClipDrawings(10, 5, many).length, MAX_CLIP_DRAWINGS);
});

const saved = (id: number, timestamp: number, extra = {}) => ({ id, timestamp, ...extra });

test("saved drawings: inside the clip, plus one still showing at mark-in", () => {
  const picked = selectSavedDrawings(
    [
      saved(1, 12),
      saved(2, 8), // up until 11 with the 3s default
      saved(3, 8, { pause_playback: true }), // its pause happened before the clip
      saved(4, 7), // ends exactly at mark-in
      saved(5, 10, { pause_playback: true }), // pause exactly at mark-in
      saved(6, 15), // at mark-out
      saved(7, 13, { display_seconds: 0 }), // never on screen
      saved(8, 14, { display_seconds: null }), // falls back to the default
    ],
    10,
    15,
    3
  );
  assert.deepEqual(picked.map(d => d.id), [2, 5, 1, 8]);
});

test("saved drawings: capped like main", () => {
  const many = Array.from({ length: 30 }, (_, i) => saved(i, 10 + i * 0.1));
  assert.equal(selectSavedDrawings(many, 10, 15, 3).length, MAX_CLIP_DRAWINGS);
});

test("key follows timing and pause, not input order", () => {
  const a = saved(1, 11);
  const b = saved(2, 12, { display_seconds: 5 });
  const key = savedDrawingsKey(selectSavedDrawings([b, a], 10, 15, 3), 3);
  assert.equal(key, "1:3:0,2:5:0");
  assert.equal(savedDrawingsKey(selectSavedDrawings([a, b], 10, 15, 3), 3), key);
  assert.notEqual(savedDrawingsKey([a, b], 4), key);
  assert.notEqual(savedDrawingsKey([a, { ...b, pause_playback: true }], 3), key);
  assert.equal(savedDrawingsKey(selectSavedDrawings([saved(9, 30)], 10, 15, 3), 3), "");
});

test("paths match across separators", () => {
  assert.ok(isSamePath("C:\\games\\a.mp4", "C:/games/a.mp4"));
  assert.ok(!isSamePath("/games/a.mp4", "/games/b.mp4"));
});
