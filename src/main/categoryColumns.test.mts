import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryUpdateFields } from "./categoryColumns.ts";

test("editable category columns pass through", () => {
  assert.deepEqual(
    categoryUpdateFields({ name: "Pick", color: "#fff", description: "x", parent_id: 2 }),
    ["name", "color", "description", "parent_id"],
  );
});

test("other keys are dropped", () => {
  assert.deepEqual(
    categoryUpdateFields({ name: "Pick", project_id: 9, id: 1, created_at: "now", "name = 1 --": 1 }),
    ["name"],
  );
});

test("nothing editable gives no fields", () => {
  assert.deepEqual(categoryUpdateFields({ project_id: 9 }), []);
});
