import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clipMetaParts,
  dotCategoryId,
  legendRows,
  sameCategoryClips,
  stepClip,
  type CourtMapCategory,
  type CourtMapClip,
} from "./courtMap.ts";
import { formatDuration } from "./format.ts";

const clip = (id: number, categories: number[] | string, extra: Partial<CourtMapClip> = {}): CourtMapClip => ({
  id,
  title: `Clip ${id}`,
  start_time: id * 10,
  end_time: id * 10 + 5,
  duration: 5,
  categories: typeof categories === "string" ? categories : JSON.stringify(categories),
  ...extra,
});

const categories: CourtMapCategory[] = [
  { id: 3, name: "Turnovers", color: "#ff0000" },
  { id: 2, name: "Sets", color: "#00ff00" },
  { id: 5, name: "Pin-downs", color: "#0000ff" },
];
const known = new Set(categories.map(c => c.id));

test("dotCategoryId picks the filtered category, else the first known one", () => {
  assert.equal(dotCategoryId(clip(1, [2, 5]), "all", known), 2);
  assert.equal(dotCategoryId(clip(1, [2, 5]), 5, known), 5);
  assert.equal(dotCategoryId(clip(1, []), "all", known), null);
  assert.equal(dotCategoryId(clip(1, "not json"), "all", known), null);
  assert.equal(dotCategoryId(clip(1, [99, 3]), "all", known), 3);
  assert.equal(dotCategoryId(clip(1, [99]), "all", known), null);
});

test("legendRows with no filter keeps every category in order, zeros included", () => {
  const drawn = [clip(1, [3]), clip(2, [3]), clip(3, [5])];
  assert.deepEqual(legendRows(drawn, categories, "all"), [
    { id: 3, count: 2 },
    { id: 2, count: 0 },
    { id: 5, count: 1 },
  ]);
});

test("legendRows puts uncategorised and deleted-only clips in a trailing null row", () => {
  const drawn = [clip(1, [3]), clip(2, []), clip(3, [99]), clip(4, [99, 5])];
  const rows = legendRows(drawn, categories, "all");
  assert.deepEqual(rows, [
    { id: 3, count: 1 },
    { id: 2, count: 0 },
    { id: 5, count: 1 },
    { id: null, count: 2 },
  ]);
  assert.equal(rows.reduce((sum, r) => sum + r.count, 0), drawn.length);
});

test("legendRows under a category filter has one row counting every drawn clip", () => {
  const drawn = [clip(1, [3]), clip(2, [2, 3]), clip(3, [99, 3])];
  const rows = legendRows(drawn, categories, 3);
  assert.deepEqual(rows, [{ id: 3, count: 3 }]);
  assert.equal(rows.reduce((sum, r) => sum + r.count, 0), drawn.length);
});

test("legendRows has no null row when every clip is categorised", () => {
  const rows = legendRows([clip(1, [3]), clip(2, [5])], categories, "all");
  assert.equal(rows.some(r => r.id === null), false);
});

test("sameCategoryClips keeps the selected dot category in game order", () => {
  const drawn = [
    clip(1, [3], { start_time: 50, video_path: "b" }),
    clip(2, [5], { start_time: 10, video_path: "a" }),
    clip(3, [3], { start_time: 90, video_path: "a" }),
    clip(4, [3], { start_time: 50, video_path: "b" }),
    clip(5, [3], { start_time: 20, video_path: "b" }),
  ];
  const order = (c: CourtMapClip) => (c.video_path === "a" ? 0 : 1);
  assert.deepEqual(sameCategoryClips(drawn, 1, "all", known, order).map(c => c.id), [3, 5, 1, 4]);
  assert.deepEqual(sameCategoryClips(drawn, 99, "all", known, order), []);
  assert.deepEqual(sameCategoryClips(drawn, 2, "all", known, order).map(c => c.id), [2]);
});

test("sameCategoryClips under a filter includes clips whose first category differs", () => {
  const drawn = [clip(1, [5]), clip(2, [3, 5]), clip(3, [5, 2])];
  assert.deepEqual(sameCategoryClips(drawn, 1, 5, known).map(c => c.id), [1, 2, 3]);
});

test("sameCategoryClips groups uncategorised clips together", () => {
  const drawn = [clip(1, []), clip(2, [3]), clip(3, [99]), clip(4, "oops")];
  assert.deepEqual(sameCategoryClips(drawn, 3, "all", known).map(c => c.id), [1, 3, 4]);
});

test("stepClip steps both ways and stops at the ends", () => {
  const list = [clip(1, []), clip(2, []), clip(3, [])];
  assert.equal(stepClip(list, 2, -1), 1);
  assert.equal(stepClip(list, 2, 1), 3);
  assert.equal(stepClip(list, 1, -1), null);
  assert.equal(stepClip(list, 3, 1), null);
  assert.equal(stepClip(list, 9, 1), null);
});

test("clipMetaParts lists numbers, quarter and an en-dash range", () => {
  const players = [
    { id: 1, number: "7" },
    { id: 2, number: "11" },
    { id: 3, number: null },
  ];
  const full = clip(1, [3], { start_time: 4443, end_time: 4451, quarter: "Q3", players: "[1]" });
  const meta = (c: CourtMapClip) => clipMetaParts(c, players, formatDuration);
  assert.deepEqual(meta(full), ["#7", "Q3", "1:14:03–1:14:11"]);
  assert.deepEqual(meta({ ...full, players: "[1, 2]" })[0], "#7, #11");
  assert.deepEqual(meta({ ...full, players: "[3, 2, 42]" })[0], "#11");
  assert.deepEqual(meta({ ...full, players: undefined, quarter: null }), ["1:14:03–1:14:11"]);
  assert.deepEqual(meta({ ...full, start_time: 243, end_time: 251 }), ["#7", "Q3", "4:03–4:11"]);
});
