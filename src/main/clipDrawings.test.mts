import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDrawingGraph,
  selectClipDrawings,
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
