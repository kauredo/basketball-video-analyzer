import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration } from "./format.ts";

test("formatDuration prints m:ss under an hour", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(9), "0:09");
  assert.equal(formatDuration(47), "0:47");
  assert.equal(formatDuration(3599), "59:59");
});

test("formatDuration prints 0:00 for NaN, negative and Infinity", () => {
  assert.equal(formatDuration(NaN), "0:00");
  assert.equal(formatDuration(-5), "0:00");
  assert.equal(formatDuration(Infinity), "0:00");
});

test("formatDuration prints h:mm:ss from an hour, dropping fractions", () => {
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(4121), "1:08:41");
  assert.equal(formatDuration(4512.9), "1:15:12");
});
