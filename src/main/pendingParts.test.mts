import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { forgetPart, isPartName, recordPart, sweepParts } from "./pendingParts.ts";

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "parts-"));
const DEAD = 999_999;
const nobodyRunning = () => false;

const setup = () => {
  const dir = scratch();
  return { dir, list: path.join(dir, "pending.json"), part: path.join(dir, "game.mp4.0a1b2c3d.part") };
};

test("a part whose app crashed is deleted on the next sweep, even right after", () => {
  const { list, part } = setup();
  fs.writeFileSync(part, "half a game");
  recordPart(list, part, DEAD);
  assert.deepEqual(sweepParts(list, nobodyRunning), [part]);
  assert.equal(fs.existsSync(part), false);
  assert.equal(fs.existsSync(list), false);
});

test("a part another running window is writing stays, and stays listed", () => {
  const { list, part } = setup();
  fs.writeFileSync(part, "still being written");
  recordPart(list, part, DEAD);
  assert.deepEqual(sweepParts(list, () => true), []);
  assert.equal(fs.existsSync(part), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(list, "utf8")), [{ part, pid: DEAD }]);
});

test("a part this process recorded counts as left over, since the sweep runs before any copy starts", () => {
  const { list, part } = setup();
  fs.writeFileSync(part, "from a crash that reused our pid");
  recordPart(list, part);
  assert.deepEqual(sweepParts(list, () => true), [part]);
});

test("a finished or cancelled copy is forgotten, so the sweep leaves its file alone", () => {
  const { list, part } = setup();
  recordPart(list, part, DEAD);
  forgetPart(list, part);
  fs.writeFileSync(part, "not ours any more");
  assert.deepEqual(sweepParts(list, nobodyRunning), []);
  assert.equal(fs.existsSync(part), true);
});

test("the sweep only deletes absolute names the app gives partial copies", () => {
  const { dir, list } = setup();
  const game = path.join(dir, "game.mp4");
  fs.writeFileSync(game, "a real game");
  fs.writeFileSync(list, JSON.stringify([
    { part: game, pid: DEAD }, { part: "x.mp4.0a1b2c3d.part", pid: DEAD }, "old", 42,
  ]));
  assert.deepEqual(sweepParts(list, nobodyRunning), []);
  assert.equal(fs.existsSync(game), true);
});

test("the sweep never follows a link", () => {
  const { dir, list } = setup();
  const game = path.join(dir, "game.mp4");
  const link = path.join(dir, "x.mp4.0a1b2c3d.part");
  fs.writeFileSync(game, "a real game");
  fs.symlinkSync(game, link);
  fs.writeFileSync(list, JSON.stringify([{ part: link, pid: DEAD }]));
  assert.deepEqual(sweepParts(list, nobodyRunning), []);
  assert.equal(fs.existsSync(game), true);
});

test("a part that can't be deleted yet stays listed for the next launch", { skip: process.platform === "win32" }, () => {
  const { dir, list } = setup();
  const locked = path.join(dir, "locked");
  fs.mkdirSync(locked);
  const part = path.join(locked, "game.mp4.0a1b2c3d.part");
  fs.writeFileSync(part, "half a game");
  recordPart(list, part, DEAD);
  fs.chmodSync(locked, 0o500);
  try {
    assert.deepEqual(sweepParts(list, nobodyRunning), []);
    assert.deepEqual(JSON.parse(fs.readFileSync(list, "utf8")), [{ part, pid: DEAD }]);
  } finally {
    fs.chmodSync(locked, 0o700);
  }
});

test("a missing or broken list sweeps nothing", () => {
  const dir = scratch();
  assert.deepEqual(sweepParts(path.join(dir, "none.json"), nobodyRunning), []);
  fs.writeFileSync(path.join(dir, "bad.json"), "{");
  assert.deepEqual(sweepParts(path.join(dir, "bad.json"), nobodyRunning), []);
});

test("recordPart refuses a name that isn't a partial copy", () => {
  assert.throws(() => recordPart(path.join(scratch(), "p.json"), "/Users/coach/game.mp4"));
  assert.equal(isPartName("/a/game.mp4.deadbeef.part"), true);
  assert.equal(isPartName("/a/game.MP4.deadbeef.part"), true);
  assert.equal(isPartName("/a/game.mp4.part"), false);
  assert.equal(isPartName("game.mp4.deadbeef.part"), false);
});
