import { test } from "node:test";
import assert from "node:assert/strict";
import { hasVideoExtension } from "./videoPath.ts";

test("video files pass, in any case", () => {
  assert.equal(hasVideoExtension("/films/game.mp4"), true);
  assert.equal(hasVideoExtension("C:\\films\\GAME.MOV"), true);
});

test("other files and non-strings are refused", () => {
  assert.equal(hasVideoExtension("/Users/me/.ssh/id_rsa"), false);
  assert.equal(hasVideoExtension("/films/game.mp4.app"), false);
  assert.equal(hasVideoExtension(undefined), false);
  assert.equal(hasVideoExtension(42), false);
});
