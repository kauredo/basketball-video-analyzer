import { test } from "node:test";
import assert from "node:assert/strict";
import { exportFoldersFor } from "./exportGroups.ts";

const categories = [
  { id: 1, parent_id: null }, // Defense
  { id: 2, parent_id: 1 }, // Defense > Zone press
  { id: 3, parent_id: null }, // Offense
  { id: 4, parent_id: 3 }, // Offense > Transition
];

test("a clip tagged only with a subcategory goes in its selected parent's folder", () => {
  assert.deepEqual(exportFoldersFor([2], [1], categories), [1]);
});

test("a clip tagged with the category itself goes in that folder", () => {
  assert.deepEqual(exportFoldersFor([1], [1], categories), [1]);
  assert.deepEqual(exportFoldersFor([2], [2], categories), [2]);
});

test("a clip in an unselected family goes nowhere", () => {
  assert.deepEqual(exportFoldersFor([4], [1], categories), []);
});

test("exporting everything keeps subcategory clips in their own folders, not their parent's", () => {
  assert.deepEqual(exportFoldersFor([2, 4], [2, 4], categories), [2, 4]);
  // Parent and child both selected: the child clip goes to the child folder only.
  assert.deepEqual(exportFoldersFor([2], [1, 2], categories), [2]);
});

test("a clip tagged with a parent and one of its children lands in both selected folders once", () => {
  assert.deepEqual(exportFoldersFor([1, 2], [1, 2], categories), [1, 2]);
});

test("only the parent selected: a clip tagged with the parent and a child is exported once", () => {
  assert.deepEqual(exportFoldersFor([1, 2], [1], categories), [1]);
});

test("a deleted category, empty inputs, and order follow the selection", () => {
  assert.deepEqual(exportFoldersFor([99], [1], categories), []);
  assert.deepEqual(exportFoldersFor([], [1], categories), []);
  assert.deepEqual(exportFoldersFor([2], [], categories), []);
  assert.deepEqual(exportFoldersFor([4, 2], [2, 4], categories), [2, 4]);
});
