import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appliedCount, hasRowCheckbox, initialChoices, initialSelected, pickAll, type ReviewField, type ReviewRow,
} from "./shareReview.ts";

const field = (name: string): ReviewField => ({
  field: name, mine: { type: "text", text: "mine" }, theirs: { type: "text", text: "theirs" },
});

const row = (token: string, group: ReviewRow["group"], options: Partial<ReviewRow> = {}): ReviewRow => ({
  token, kind: "clip", group, ticked: group !== "deleted", preview: { title: token },
  changes: [], conflicts: [], inUse: 0, recut: false, ...options,
});

const conflictOnly = row("clip:a", "conflict", { conflicts: [field("title"), field("notes")] });
const conflictWithChanges = row("clip:b", "conflict", { changes: [field("status")], conflicts: [field("title")] });
const changed = row("clip:c", "changed", { changes: [field("notes")] });
const deleted = row("clip:d", "deleted");
// Their deletion of a row I edited arrives as a conflict that is not ticked.
const deleteEdited = row("clip:e", "conflict", { ticked: false, conflicts: [field("exists")] });

test("initialSelected ticks every conflict row and the others by ticked", () => {
  assert.deepEqual(initialSelected([conflictOnly, conflictWithChanges, changed, deleted, deleteEdited]), {
    "clip:a": true, "clip:b": true, "clip:c": true, "clip:d": false, "clip:e": true,
  });
});

test("initialChoices puts every conflicting field on mine", () => {
  assert.deepEqual(initialChoices([conflictOnly, changed]), { "clip:a": { title: "mine", notes: "mine" } });
});

test("only a conflict row with its own changes has a checkbox", () => {
  assert.deepEqual([conflictOnly, conflictWithChanges, changed].map(hasRowCheckbox), [false, true, true]);
});

test("a conflict row with only Yours counts 0, and one or two fields on Theirs count 1", () => {
  const rows = [conflictOnly];
  const selected = initialSelected(rows);
  assert.equal(appliedCount(rows, selected, initialChoices(rows)), 0);
  assert.equal(appliedCount(rows, selected, { "clip:a": { title: "theirs", notes: "mine" } }), 1);
  assert.equal(appliedCount(rows, selected, { "clip:a": { title: "theirs", notes: "theirs" } }), 1);
});

test("a conflict row with its own changes counts 1 ticked with every field mine, 0 unticked", () => {
  const rows = [conflictWithChanges];
  const choices = initialChoices(rows);
  assert.equal(appliedCount(rows, { "clip:b": true }, choices), 1);
  assert.equal(appliedCount(rows, { "clip:b": false }, choices), 0);
  assert.equal(appliedCount(rows, { "clip:b": false }, { "clip:b": { title: "theirs" } }), 0);
});

test("other rows count only when selected", () => {
  const rows = [changed, deleted];
  assert.equal(appliedCount(rows, { "clip:c": true, "clip:d": false }, {}), 1);
  assert.equal(appliedCount(rows, { "clip:c": false, "clip:d": true }, {}), 1);
  assert.equal(appliedCount(rows, {}, {}), 0);
});

test("Keep all yours counts 0 and Take all theirs counts every conflict row", () => {
  const rows = [conflictOnly, conflictWithChanges, deleteEdited];
  const start = { choices: initialChoices(rows), selected: initialSelected(rows) };
  const theirs = pickAll(start.choices, start.selected, rows, "theirs");
  assert.equal(appliedCount(rows, theirs.selected, theirs.choices), 3);
  const mine = pickAll(theirs.choices, theirs.selected, rows, "mine");
  assert.equal(appliedCount(rows, mine.selected, mine.choices), 0);
  // Keep all yours unticks the row whose own changes would otherwise still apply.
  assert.equal(mine.selected["clip:b"], false);
  assert.equal(mine.selected["clip:a"], true);
});

test("pickAll theirs then mine round-trips and leaves rows outside the list alone", () => {
  const all = [conflictOnly, conflictWithChanges, changed, deleted];
  const choices = { ...initialChoices(all), "clip:x": { title: "theirs" as const } };
  const selected = { ...initialSelected(all), "clip:c": false };
  const conflicts = [conflictOnly, conflictWithChanges];
  const there = pickAll(choices, selected, conflicts, "theirs");
  const back = pickAll(there.choices, there.selected, conflicts, "mine");
  assert.deepEqual(back.choices, choices);
  assert.deepEqual(back.selected, { ...selected, "clip:b": false });
  assert.equal(back.selected["clip:c"], false);
  assert.equal(back.selected["clip:d"], false);
  assert.deepEqual(back.choices["clip:x"], { title: "theirs" });
});
