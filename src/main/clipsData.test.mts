import { test } from "node:test";
import assert from "node:assert/strict";
import { clipRows, clipsCsv, clipsJson } from "./clipsData.ts";

const categories = new Map([[1, "Offense"], [2, "Pick, roll"]]);
const players = new Map([[7, "Ana"]]);
const clip = {
  title: "=SUM(A1)",
  categories: "[1,2,99]",
  players: "[7]",
  quarter: "Q2",
  start_time: 12,
  end_time: 20.5,
  duration: 8.5,
  notes: 'said "box"',
  created_at: "2026-11-16 10:00:00",
  status: "keep",
};

test("ids become names, and unknown ids say so", () => {
  const [row] = clipRows([clip], categories, players);
  assert.deepEqual(row.categories, ["Offense", "Pick, roll", "Unknown"]);
  assert.deepEqual(row.players, ["Ana"]);
});

test("broken or missing id lists become empty lists", () => {
  const [row] = clipRows([{ ...clip, categories: "not json", players: undefined }], categories, players);
  assert.deepEqual([row.categories, row.players], [[], []]);
});

test("the CSV quotes commas and quotes, and defuses formulas", () => {
  const csv = clipsCsv(clipRows([clip], categories, players));
  assert.equal(
    csv.split("\n")[1],
    `'=SUM(A1),"Offense; Pick, roll; Unknown",Ana,Q2,12.00,20.50,8.50,"said ""box""",2026-11-16 10:00:00,keep`,
  );
});

test("the JSON keeps the field order the export always had", () => {
  const [row] = JSON.parse(clipsJson(clipRows([clip], categories, players)));
  assert.deepEqual(Object.keys(row), [
    "title", "categories", "players", "quarter", "start_time", "end_time",
    "duration", "notes", "created_at", "status",
  ]);
});
