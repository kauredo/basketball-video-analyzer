import assert from "node:assert/strict";
import { test } from "node:test";
import { clipNumbers, listColumns, parseListWidth } from "./clipList.ts";

test("parseListWidth round-trips the three widths", () => {
  assert.equal(parseListWidth("narrow"), "narrow");
  assert.equal(parseListWidth("wide"), "wide");
  assert.equal(parseListWidth("full"), "full");
});

test("parseListWidth falls back to narrow for anything else", () => {
  assert.equal(parseListWidth(null), "narrow");
  assert.equal(parseListWidth("Wide"), "narrow");
  assert.equal(parseListWidth(3), "narrow");
  assert.equal(parseListWidth(undefined), "narrow");
});

const all = ["number", "time", "category", "title", "notes", "duration", "status"];

test("listColumns gives all seven in board order when wide, unfiltered, with a status", () => {
  assert.deepEqual(listColumns({ width: "wide", singleCategory: false, anyStatus: true }), all);
});

test("listColumns drops one column per rule", () => {
  const without = (col: string) => all.filter(c => c !== col);
  assert.deepEqual(listColumns({ width: "wide", singleCategory: true, anyStatus: true }), without("category"));
  assert.deepEqual(listColumns({ width: "wide", singleCategory: false, anyStatus: false }), without("status"));
  assert.deepEqual(listColumns({ width: "narrow", singleCategory: false, anyStatus: true }), without("notes"));
});

test("listColumns treats full like wide", () => {
  for (const singleCategory of [true, false]) {
    for (const anyStatus of [true, false]) {
      assert.deepEqual(
        listColumns({ width: "full", singleCategory, anyStatus }),
        listColumns({ width: "wide", singleCategory, anyStatus }),
      );
    }
  }
});

test("clipNumbers numbers clips by start time, whatever the input order", () => {
  const numbers = clipNumbers([
    { id: 1, start_time: 300 },
    { id: 2, start_time: 10 },
    { id: 3, start_time: 4121 },
  ]);
  assert.equal(numbers.get(2), 1);
  assert.equal(numbers.get(1), 2);
  assert.equal(numbers.get(3), 3);
});

test("clipNumbers breaks equal start times by id", () => {
  const numbers = clipNumbers([
    { id: 9, start_time: 50 },
    { id: 4, start_time: 50 },
  ]);
  assert.equal(numbers.get(4), 1);
  assert.equal(numbers.get(9), 2);
});
