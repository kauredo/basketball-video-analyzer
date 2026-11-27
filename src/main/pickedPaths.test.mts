import { test } from "node:test";
import assert from "node:assert/strict";
import { createPickedPaths } from "./pickedPaths.ts";

test("a picked path is accepted once", () => {
  const picked = createPickedPaths(60_000);
  picked.remember("/films/game.mp4");
  assert.equal(picked.consume("/films/game.mp4"), true);
  assert.equal(picked.consume("/films/game.mp4"), false);
});

test("a path the picker never returned is refused", () => {
  const picked = createPickedPaths(60_000);
  picked.remember("/films/game.mp4");
  assert.equal(picked.consume("/films/other.mp4"), false);
  assert.equal(picked.consume(undefined), false);
  assert.equal(picked.consume("/films/game.mp4"), true);
});

test("a picked path expires", () => {
  let clock = 0;
  const picked = createPickedPaths(1000, () => clock);
  picked.remember("/films/game.mp4");
  clock = 1001;
  assert.equal(picked.consume("/films/game.mp4"), false);
});
