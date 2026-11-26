import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NO_FILTERS,
  activeFilterCount,
  categoryCounts,
  categoryFamily,
  clipInCategory,
  filterClips,
  findCategory,
  parseIds,
  playerCounts,
  pruneStaleFilters,
  summarize,
} from "./clipFilters.ts";

const categories = [
  {
    id: 1,
    name: "Offense",
    color: "#111111",
    children: [
      { id: 11, name: "Pick and roll", color: "#222222" },
      { id: 12, name: "Fast break", color: "#333333" },
    ],
  },
  { id: 2, name: "Turnovers", color: "#444444" },
];
const family = categoryFamily(categories);

const clip = (over: Partial<{ title: string; notes: string; categories: string; players: string; status: "keep" | "cut" | "review" | null; duration: number }> = {}) => ({
  title: "Clip",
  categories: "[]",
  duration: 10,
  ...over,
});

test("a parent matches its child's clips; a child does not match the parent's", () => {
  assert.equal(clipInCategory(clip({ categories: "[11]" }), 1, family), true);
  assert.equal(clipInCategory(clip({ categories: "[1]" }), 11, family), false);
  assert.equal(clipInCategory(clip({ categories: "[99]" }), 99, family), true);
});

test("categoryCounts counts a family once per clip and children exactly", () => {
  const clips = [clip({ categories: "[1,11]" }), clip({ categories: "[11]" }), clip({ categories: "[12]" }), clip({ categories: "[2]" })];
  const counts = categoryCounts(clips, categories);
  assert.equal(counts.get(1), 3);
  assert.equal(counts.get(11), 2);
  assert.equal(counts.get(12), 1);
  assert.equal(counts.get(2), 1);
});

test("findCategory finds parents and children", () => {
  assert.equal(findCategory(categories, 12)?.name, "Fast break");
  assert.equal(findCategory(categories, 2)?.name, "Turnovers");
  assert.equal(findCategory(categories, 404), undefined);
});

test("filterClips ANDs search, category, player and status", () => {
  const a = clip({ title: "Early drive", categories: "[11]", players: "[7]", status: "keep" });
  const b = clip({ title: "Late", notes: "great DRIVE", categories: "[11]", players: "[4]", status: "keep" });
  const c = clip({ title: "Drive", categories: "[2]", players: "[7]", status: "keep" });
  const d = clip({ title: "Drive again", categories: "[1]", players: "[7]", status: "cut" });
  const all = [a, b, c, d];

  assert.deepEqual(filterClips(all, NO_FILTERS, family), all);
  assert.deepEqual(filterClips(all, { ...NO_FILTERS, search: "drive" }, family), all);
  assert.deepEqual(filterClips(all, { ...NO_FILTERS, search: "great" }, family), [b]);
  assert.deepEqual(
    filterClips(all, { search: "drive", categoryId: 1, playerId: 7, status: "keep" }, family),
    [a],
  );
});

test("bad JSON in categories or players matches nothing and does not throw", () => {
  const broken = clip({ categories: "{nope", players: "not json" });
  assert.deepEqual(filterClips([broken], { ...NO_FILTERS, categoryId: 1 }, family), []);
  assert.deepEqual(filterClips([broken], { ...NO_FILTERS, playerId: 7 }, family), []);
  assert.deepEqual(parseIds("{\"a\":1}"), []);
  assert.deepEqual(parseIds(null), []);
});

test("playerCounts counts each clip once per player", () => {
  const counts = playerCounts([clip({ players: "[7,4]" }), clip({ players: "[7,7]" }), clip({ players: "bad" })]);
  assert.equal(counts.get(7), 2);
  assert.equal(counts.get(4), 1);
});

test("activeFilterCount ignores search", () => {
  assert.equal(activeFilterCount(NO_FILTERS), 0);
  assert.equal(activeFilterCount({ ...NO_FILTERS, search: "x" }), 0);
  assert.equal(activeFilterCount({ search: "x", categoryId: 1, playerId: 2, status: "cut" }), 3);
});

test("summarize sums the shown durations", () => {
  assert.deepEqual(summarize([clip({ duration: 20 }), clip({ duration: 27.5 })], 16), {
    shown: 2,
    total: 16,
    seconds: 47.5,
  });
  assert.deepEqual(summarize([], 0), { shown: 0, total: 0, seconds: 0 });
});

test("summarize counts a zero or NaN duration as 0", () => {
  assert.equal(summarize([clip({ duration: 0 })], 1).seconds, 0);
  assert.equal(summarize([clip({ duration: NaN }), clip({ duration: 5 })], 2).seconds, 5);
});

test("pruneStaleFilters drops category and player ids that no longer exist", () => {
  const players = [{ id: 7 }];
  const live = { search: "x", categoryId: 12, playerId: 7, status: "keep" as const };
  assert.equal(pruneStaleFilters(live, categories, players), live);
  assert.equal(pruneStaleFilters(NO_FILTERS, categories, players), NO_FILTERS);
  assert.deepEqual(
    pruneStaleFilters({ ...live, categoryId: 404, playerId: 9 }, categories, players),
    { ...live, categoryId: null, playerId: null },
  );
  assert.deepEqual(
    pruneStaleFilters({ ...live, categoryId: 2, playerId: 9 }, categories, players),
    { ...live, categoryId: 2, playerId: null },
  );
});
