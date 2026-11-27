import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUNDLE_IMAGE_EXTENSIONS, BUNDLE_VIDEO_EXTENSIONS, MAX_BUNDLE_NAME, clipFileName, hasBundleExtension,
  isSafeBundleName, safeName, thumbnailFileName, uniqueName, videoFileNames,
} from "./bundleNames.ts";

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

test("clip files are named by uid, thumbnails get -thumb, extensions lowercased", () => {
  assert.equal(clipFileName("u1", "/clips/x.MP4"), "u1.mp4");
  assert.equal(thumbnailFileName("u1", "C:\\clips\\x_thumb.JPG"), "u1-thumb.jpg");
  assert.notEqual(clipFileName("u1", "/c/x.jpg"), thumbnailFileName("u1", "/c/x.jpg"));
  assert.equal(clipFileName("u1", "/clips/noext"), "u1");
  assert.equal(clipFileName("u1", "/clips/x.m:p4"), "u1");
});

test("a name over the cap loses stem, never its extension", () => {
  const name = safeName(`${"a".repeat(300)}.mp4`, "video");
  assert.equal(name, `${"a".repeat(MAX_BUNDLE_NAME - 4)}.mp4`);
  assert.equal(safeName("b".repeat(300), "video"), "b".repeat(MAX_BUNDLE_NAME));
});

test("a dotfile keeps its extension behind the fallback", () => {
  assert.equal(safeName(".mp4", "video"), "video.mp4");
  assert.equal(safeName("..hidden.mov", "video"), "hidden.mov");
});

test("names with several dots get their suffix before the last extension", () => {
  assert.deepEqual(videoFileNames(["a.b.c.mp4", "a.b.c.mp4", "noext", "noext"]), ["a.b.c.mp4", "a.b.c (2).mp4", "noext", "noext (2)"]);
});

test("video extensions are lowercased, and a case-only clash is a duplicate", () => {
  assert.deepEqual(videoFileNames(["Game.MP4", "game.mp4"]), ["Game.mp4", "game (2).mp4"]);
});

test("every name safeName makes passes the shared rule", () => {
  for (const name of ["CON", "aux.mp4", " .x. ", "a<b>.mp4", ".mp4", "...", "🏀".repeat(200), "Final. ", "x\u0007y"]) {
    assert.ok(isSafeBundleName(safeName(name, "video")), name);
  }
});

test("the shared rule refuses what Windows or the bundle cannot hold", () => {
  for (const name of [
    "", ".", "..", ".hidden.mp4", "CON", "con.mp4", "LPT1.jpg", "x.mp4.", "x.mp4 ", "a\u0001.mp4",
    "a<b.mp4", "a>b.mp4", "a:b.mp4", "a\"b.mp4", "a/b.mp4", "a\\b.mp4", "a|b.mp4", "a?b.mp4", "a*b.mp4",
  ]) {
    assert.equal(isSafeBundleName(name), false, JSON.stringify(name));
  }
  assert.ok(isSafeBundleName("Jogo 1 (2).mp4"));
  assert.ok(isSafeBundleName("Console.mp4"));
});

test("extensions must match the allowlist exactly", () => {
  assert.ok(hasBundleExtension("a.mp4", BUNDLE_VIDEO_EXTENSIONS));
  assert.ok(!hasBundleExtension("a.MP4", BUNDLE_VIDEO_EXTENSIONS));
  assert.ok(!hasBundleExtension("a.exe", BUNDLE_VIDEO_EXTENSIONS));
  assert.ok(!hasBundleExtension("a.jpg", BUNDLE_VIDEO_EXTENSIONS));
  assert.ok(hasBundleExtension("a.jpeg", BUNDLE_IMAGE_EXTENSIONS));
  assert.ok(!hasBundleExtension(".png", BUNDLE_IMAGE_EXTENSIONS));
});
