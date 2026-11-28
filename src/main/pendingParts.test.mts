import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { forgetPart, isPartName, recordPart, sweepParts } from "./pendingParts.ts";

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "parts-"));

test("a part left by a crash is deleted on the next sweep", () => {
  const dir = scratch();
  const list = path.join(dir, "pending.json");
  const part = path.join(dir, "game.mp4.0a1b2c3d.part");
  fs.writeFileSync(part, "half a game");
  recordPart(list, part);
  assert.deepEqual(sweepParts(list, Date.now() + 10 * 60_000), [part]);
  assert.equal(fs.existsSync(part), false);
  assert.equal(fs.existsSync(list), false);
});

test("a part written to in the last few minutes may be another window's copy, so it stays listed", () => {
  const dir = scratch();
  const list = path.join(dir, "pending.json");
  const part = path.join(dir, "game.mp4.0a1b2c3d.part");
  fs.writeFileSync(part, "still being written");
  recordPart(list, part);
  assert.deepEqual(sweepParts(list), []);
  assert.equal(fs.existsSync(part), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(list, "utf8")), [part]);
});

test("a finished or cancelled copy is forgotten, so the sweep leaves its file alone", () => {
  const dir = scratch();
  const list = path.join(dir, "pending.json");
  const part = path.join(dir, "game.mp4.0a1b2c3d.part");
  recordPart(list, part);
  forgetPart(list, part);
  fs.writeFileSync(part, "not ours any more");
  assert.deepEqual(sweepParts(list, Date.now() + 10 * 60_000), []);
  assert.equal(fs.existsSync(part), true);
});

test("the sweep only deletes names the app gives partial copies", () => {
  const dir = scratch();
  const list = path.join(dir, "pending.json");
  const game = path.join(dir, "game.mp4");
  fs.writeFileSync(game, "a real game");
  fs.writeFileSync(list, JSON.stringify([game, 42]));
  assert.deepEqual(sweepParts(list, Date.now() + 10 * 60_000), []);
  assert.equal(fs.existsSync(game), true);
});

test("the sweep never follows a link", () => {
  const dir = scratch();
  const list = path.join(dir, "pending.json");
  const game = path.join(dir, "game.mp4");
  const link = path.join(dir, "x.mp4.0a1b2c3d.part");
  fs.writeFileSync(game, "a real game");
  fs.symlinkSync(game, link);
  fs.writeFileSync(list, JSON.stringify([link]));
  assert.deepEqual(sweepParts(list, Date.now() + 10 * 60_000), []);
  assert.equal(fs.existsSync(game), true);
});

test("a missing or broken list sweeps nothing", () => {
  const dir = scratch();
  assert.deepEqual(sweepParts(path.join(dir, "none.json")), []);
  fs.writeFileSync(path.join(dir, "bad.json"), "{");
  assert.deepEqual(sweepParts(path.join(dir, "bad.json")), []);
});

test("recordPart refuses a name that isn't a partial copy", () => {
  assert.throws(() => recordPart(path.join(scratch(), "p.json"), "/Users/coach/game.mp4"));
  assert.equal(isPartName("/a/game.mp4.deadbeef.part"), true);
  assert.equal(isPartName("/a/game.mp4.part"), false);
});
