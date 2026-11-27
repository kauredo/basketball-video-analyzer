import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeProjectVideosDir } from "./projectVideosDir.ts";

const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-videos-dir-")));
after(() => fs.rmSync(temp, { recursive: true, force: true }));

const setup = (name: string) => {
  const userData = path.join(temp, name);
  const videos = path.join(userData, "videos");
  fs.mkdirSync(videos, { recursive: true });
  const folder = (uid: string, files: string[]) => {
    fs.mkdirSync(path.join(videos, uid));
    for (const file of files) fs.writeFileSync(path.join(videos, uid, file), "video");
    return path.join(videos, uid);
  };
  return { userData, videos, folder };
};

test("removes the project's folder, with a copy relinked away from, and leaves other projects' folders", async () => {
  const { videos, folder } = setup("removes");
  const mine = folder("mine", ["game.mp4", "relinked-away.mp4"]);
  const theirs = folder("theirs", ["other.mp4"]);
  const result = await removeProjectVideosDir(videos, "mine", [path.join(theirs, "other.mp4"), "/Users/coach/own.mp4"]);
  assert.equal(result, "removed");
  assert.equal(fs.existsSync(mine), false);
  assert.equal(fs.existsSync(path.join(theirs, "other.mp4")), true);
});

test("a project with no folder is fine", async () => {
  const { videos } = setup("missing");
  assert.equal(await removeProjectVideosDir(videos, "never-imported", []), "missing");
  assert.equal(await removeProjectVideosDir(path.join(temp, "no-user-data", "videos"), "x", []), "missing");
});

test("does not follow a symlinked folder", async () => {
  const { userData, videos } = setup("symlink");
  const outside = path.join(userData, "received");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "keep.mp4"), "video");
  fs.symlinkSync(outside, path.join(videos, "linked"));
  assert.equal(await removeProjectVideosDir(videos, "linked", []), "refused");
  assert.equal(fs.existsSync(path.join(outside, "keep.mp4")), true);
  assert.equal(fs.lstatSync(path.join(videos, "linked")).isSymbolicLink(), true);
});

test("refuses a uid that is not a direct child of the videos folder", async () => {
  const { userData, videos } = setup("escape");
  fs.writeFileSync(path.join(userData, "keep.txt"), "x");
  assert.equal(await removeProjectVideosDir(videos, "..", []), "refused");
  assert.equal(await removeProjectVideosDir(videos, "", []), "refused");
  assert.equal(fs.existsSync(path.join(userData, "keep.txt")), true);
});

test("refuses a file named like the folder", async () => {
  const { videos } = setup("file");
  fs.writeFileSync(path.join(videos, "flat"), "x");
  assert.equal(await removeProjectVideosDir(videos, "flat", []), "refused");
  assert.equal(fs.existsSync(path.join(videos, "flat")), true);
});

test("refuses uids that are the folder itself or a nested path", async () => {
  const { videos, folder } = setup("dot");
  folder("a", []);
  fs.mkdirSync(path.join(videos, "a", "b"));
  assert.equal(await removeProjectVideosDir(videos, ".", []), "refused");
  assert.equal(await removeProjectVideosDir(videos, "a/b", []), "refused");
  assert.equal(fs.existsSync(path.join(videos, "a", "b")), true);
});

test("a recording reached through a symlink elsewhere that resolves into the folder keeps it", async () => {
  const { userData, videos, folder } = setup("linked-use");
  const mine = folder("mine", ["game.mp4"]);
  const elsewhere = path.join(userData, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(path.join(mine, "game.mp4"), path.join(elsewhere, "game.mp4"));
  assert.equal(await removeProjectVideosDir(videos, "mine", [path.join(elsewhere, "game.mp4")]), "in-use");
  assert.equal(fs.existsSync(path.join(mine, "game.mp4")), true);
});

test("an in-use path whose file is missing still keeps the folder", async () => {
  const { videos, folder } = setup("missing-use");
  const mine = folder("mine", []);
  assert.equal(await removeProjectVideosDir(videos, "mine", [path.join(mine, "gone.mp4")]), "in-use");
  assert.equal(fs.existsSync(mine), true);
});

test("a sibling folder sharing the uid as a prefix does not count as in use", async () => {
  const { videos, folder } = setup("prefix");
  const mine = folder("mine", ["game.mp4"]);
  const sibling = folder("mine2", ["x.mp4"]);
  assert.equal(await removeProjectVideosDir(videos, "mine", [path.join(sibling, "x.mp4")]), "removed");
  assert.equal(fs.existsSync(mine), false);
  assert.equal(fs.existsSync(path.join(sibling, "x.mp4")), true);
});

test("one recording relinked out and one still inside keeps the folder", async () => {
  const { userData, videos, folder } = setup("half-relinked");
  const mine = folder("mine", ["old.mp4", "kept.mp4"]);
  fs.writeFileSync(path.join(userData, "moved.mp4"), "video");
  assert.equal(await removeProjectVideosDir(videos, "mine",
    [path.join(userData, "moved.mp4"), path.join(mine, "kept.mp4")]), "in-use");
  assert.equal(fs.existsSync(path.join(mine, "old.mp4")), true);
});

test("keeps the folder while another project still plays a recording from it", async () => {
  const { videos, folder } = setup("in-use");
  const mine = folder("mine", ["game.mp4"]);
  assert.equal(await removeProjectVideosDir(videos, "mine", [path.join(mine, "game.mp4")]), "in-use");
  assert.equal(fs.existsSync(path.join(mine, "game.mp4")), true);
});
