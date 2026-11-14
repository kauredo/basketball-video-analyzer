import { test } from "node:test";
import assert from "node:assert/strict";
import { isInsideDir } from "./insideDir.ts";

test("files in the folder or below it are inside", () => {
  assert.equal(isInsideDir("/data/clips/a.mp4", "/data/clips"), true);
  assert.equal(isInsideDir("/data/clips/sub/a.mp4", "/data/clips"), true);
});

test("the folder itself, siblings and parents are outside", () => {
  assert.equal(isInsideDir("/data/clips", "/data/clips"), false);
  assert.equal(isInsideDir("/data/clips-other/a.mp4", "/data/clips"), false);
  assert.equal(isInsideDir("/data/clips/../a.app", "/data/clips"), false);
  assert.equal(isInsideDir("/Applications/Calculator.app", "/data/clips"), false);
});
