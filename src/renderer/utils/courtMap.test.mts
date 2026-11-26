import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dotCategoryId,
  legendRows,
  sameCategoryClips,
  stepClip,
  type CategoryFilter,
  type CourtMapCategory,
  type CourtMapClip,
} from "./courtMap.ts";

type TestClip = CourtMapClip & { video_path?: string };

const clip = (id: number, catIds: number[], extra: Partial<TestClip> = {}): TestClip => ({
  id,
  start_time: id * 10,
  catIds,
  ...extra,
});

// A category filter that matches only its own id unless members are given.
const only = (id: number, members: number[] = [id]): CategoryFilter => ({ id, ids: new Set(members) });

const categories: CourtMapCategory[] = [
  { id: 3, name: "Turnovers", color: "#ff0000" },
  { id: 2, name: "Sets", color: "#00ff00" },
  { id: 5, name: "Pin-downs", color: "#0000ff" },
];
const known = new Set(categories.map(c => c.id));
const sum = (rows: { count: number }[]) => rows.reduce((total, r) => total + r.count, 0);

test("dotCategoryId picks the filtered category, else the first known one", () => {
  assert.equal(dotCategoryId(clip(1, [2, 5]), "all", known), 2);
  assert.equal(dotCategoryId(clip(1, [2, 5]), only(5), known), 5);
  assert.equal(dotCategoryId(clip(1, []), "all", known), null);
  assert.equal(dotCategoryId(clip(1, [99, 3]), "all", known), 3);
  assert.equal(dotCategoryId(clip(1, [99]), "all", known), null);
});

test("dotCategoryId draws a subcategory clip in its filtered parent's colour", () => {
  // 3 is the parent, 5 its subcategory.
  assert.equal(dotCategoryId(clip(1, [2, 5]), only(3, [3, 5]), known), 3);
});

test("dotCategoryId ignores a filter id that is not a known category", () => {
  assert.equal(dotCategoryId(clip(1, [42, 5]), only(42), known), 5);
  assert.equal(dotCategoryId(clip(1, [42]), only(42), known), null);
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
  assert.equal(sum(rows), drawn.length);
});

test("legendRows under a category filter has one row counting every drawn clip", () => {
  const drawn = [clip(1, [3]), clip(2, [2, 3]), clip(3, [99, 3])];
  const rows = legendRows(drawn, categories, only(3));
  assert.deepEqual(rows, [{ id: 3, count: 3 }]);
  assert.equal(sum(rows), drawn.length);
});

test("legendRows under a parent filter counts its subcategory clips in the parent row", () => {
  const drawn = [clip(1, [3]), clip(2, [5]), clip(3, [2, 5])];
  const rows = legendRows(drawn, categories, only(3, [3, 5]));
  assert.deepEqual(rows, [{ id: 3, count: 3 }]);
});

test("legendRows treats a filter id missing from categories as no filter", () => {
  const drawn = [clip(1, [42, 3]), clip(2, [42]), clip(3, [42, 5])];
  const rows = legendRows(drawn, categories, only(42));
  assert.deepEqual(rows, [
    { id: 3, count: 1 },
    { id: 2, count: 0 },
    { id: 5, count: 1 },
    { id: null, count: 1 },
  ]);
  assert.equal(sum(rows), drawn.length);
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
  const order = (c: TestClip) => (c.video_path === "a" ? 0 : 1);
  assert.deepEqual(sameCategoryClips(drawn, 1, "all", known, order).map(c => c.id), [3, 5, 1, 4]);
  assert.deepEqual(sameCategoryClips(drawn, 99, "all", known, order), []);
  assert.deepEqual(sameCategoryClips(drawn, 2, "all", known, order).map(c => c.id), [2]);
});

test("sameCategoryClips sorts clips whose game is not found last", () => {
  const drawn = [
    clip(1, [3], { start_time: 5, video_path: "gone" }),
    clip(2, [3], { start_time: 90, video_path: "b" }),
    clip(3, [3], { start_time: 50, video_path: "a" }),
  ];
  const order = (c: TestClip) => ["a", "b"].indexOf(c.video_path ?? "");
  assert.deepEqual(sameCategoryClips(drawn, 2, "all", known, order).map(c => c.id), [3, 2, 1]);
});

test("sameCategoryClips under a filter includes clips whose first category differs", () => {
  const drawn = [clip(1, [5]), clip(2, [3, 5]), clip(3, [5, 2])];
  assert.deepEqual(sameCategoryClips(drawn, 1, only(5), known).map(c => c.id), [1, 2, 3]);
});

test("sameCategoryClips groups uncategorised clips together", () => {
  const drawn = [clip(1, []), clip(2, [3]), clip(3, [99]), clip(4, [])];
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
