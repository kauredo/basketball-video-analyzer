import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFolderName } from "./safeFolderName.ts";

test("ordinary names are kept", () => {
  assert.equal(safeFolderName("Pick and Roll"), "Pick and Roll");
});

test("separators and characters Windows rejects become underscores", () => {
  assert.equal(safeFolderName("Pick / Roll"), "Pick _ Roll");
  assert.equal(safeFolderName('a\\b:c*d?e"f<g>h|i'), "a_b_c_d_e_f_g_h_i");
});

test("names that would leave the export folder or are empty fall back", () => {
  assert.equal(safeFolderName(".."), "Category");
  assert.equal(safeFolderName("."), "Category");
  assert.equal(safeFolderName("   "), "Category");
});
