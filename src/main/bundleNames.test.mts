import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BUNDLE_NAME, safeName, uidFileName, uniqueName, videoFileNames } from "./bundleNames.ts";

test("characters Windows refuses and control characters are stripped", () => {
  assert.equal(safeName('Game <1>: "home"/away\\ |a?b*\u0001\u001f', "Project"), "Game 1 homeaway ab");
});

test("letters in any script are kept", () => {
  assert.equal(safeName("Οδηγός · Šabac", "Project"), "Οδηγός · Šabac");
});

test("trailing dots and spaces go, since Windows drops them", () => {
  assert.equal(safeName("  Final...  ", "Project"), "Final");
  assert.equal(safeName("vs. Porto . .", "Project"), "vs. Porto");
});

test("reserved Windows device names are renamed, with or without an extension", () => {
  for (const name of ["CON", "nul", "Com1", "LPT9", "aux.mp4", "PRN.txt"]) {
    assert.equal(safeName(name, "Project"), `_${name}`);
  }
  assert.equal(safeName("Console", "Project"), "Console");
  assert.equal(safeName("COM10", "Project"), "COM10");
});

test("long names are capped without splitting a character", () => {
  assert.equal(safeName("a".repeat(500), "Project"), "a".repeat(MAX_BUNDLE_NAME));
  assert.equal(safeName("🏀".repeat(200), "Project"), "🏀".repeat(MAX_BUNDLE_NAME));
  assert.equal(safeName(`${"a".repeat(MAX_BUNDLE_NAME - 1)}. tail`, "Project"), "a".repeat(MAX_BUNDLE_NAME - 1));
});

test("a name with nothing left falls back", () => {
  for (const name of ["", "   ", "...", "<>:?*", "\u0000"]) assert.equal(safeName(name, "Project"), "Project");
});

test("duplicates get (2), (3), and files keep their extension last", () => {
  const taken = new Set(["Game", "Game (2)"]);
  assert.equal(uniqueName("Game", name => taken.has(name)), "Game (3)");
  assert.equal(uniqueName("Other", name => taken.has(name)), "Other");
  assert.equal(uniqueName("Game 1.5", name => name === "Game 1.5"), "Game 1.5 (2)");
  assert.equal(uniqueName("clip.mp4", name => name === "clip.mp4", true), "clip (2).mp4");
});

test("video names are made safe and unique ignoring case", () => {
  assert.deepEqual(
    videoFileNames(["game.mp4", "GAME.mp4", "game.mp4", "a:b.mov", ""]),
    ["game.mp4", "GAME (2).mp4", "game (3).mp4", "ab.mov", "video"],
  );
});

test("clip files are named by uid and keep a plain extension", () => {
  assert.equal(uidFileName("u1", "/clips/x.MP4"), "u1.mp4");
  assert.equal(uidFileName("u1", "C:\\clips\\x_thumb.jpg"), "u1.jpg");
  assert.equal(uidFileName("u1", "/clips/noext"), "u1");
  assert.equal(uidFileName("u1", "/clips/x.m:p4"), "u1");
});
