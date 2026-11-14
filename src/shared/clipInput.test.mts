import { test } from "node:test";
import assert from "node:assert/strict";
import { clipFileTitle, clipInputError } from "./clipInput.ts";

test("usable times and title pass", () => {
  assert.equal(clipInputError(0, 4.5, "Pick and roll"), null);
});

test("times that are not finite numbers are rejected", () => {
  assert.equal(clipInputError(NaN, 4, "a"), "ERROR_INVALID_TIME");
  assert.equal(clipInputError(0, NaN, "a"), "ERROR_INVALID_TIME");
  assert.equal(clipInputError(0, Infinity, "a"), "ERROR_INVALID_TIME");
  assert.equal(clipInputError("0", 4, "a"), "ERROR_INVALID_TIME");
});

test("a title that is not a string is rejected", () => {
  assert.equal(clipInputError(0, 4, 42), "ERROR_INVALID_TITLE");
  assert.equal(clipInputError(0, 4, undefined), "ERROR_INVALID_TITLE");
});

test("the existing checks keep their codes", () => {
  assert.equal(clipInputError(4, 4, "a"), "ERROR_INVALID_DURATION");
  assert.equal(clipInputError(-1, 4, "a"), "ERROR_INVALID_TIME");
  assert.equal(clipInputError(0, 4, "   "), "ERROR_INVALID_TITLE");
});

test("file titles keep safe characters and stop at 80", () => {
  assert.equal(clipFileTitle("Pick / Roll"), "Pick___Roll");
  assert.equal(clipFileTitle("x".repeat(300)).length, 80);
});
