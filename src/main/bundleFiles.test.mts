import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BUNDLE_FILE_CHANGED, BUNDLE_FILE_UNSAFE, resolveBundleFile } from "./bundleFiles.ts";

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-bundle-files-")));
after(() => fs.rmSync(base, { recursive: true, force: true }));
let n = 0;

/** A bundle folder with videos/game.mp4 (10 bytes), clips/c.mp4 and Game.bvap. */
const bundle = () => {
  const root = path.join(base, `b${n++}`);
  fs.mkdirSync(path.join(root, "videos"), { recursive: true });
  fs.mkdirSync(path.join(root, "clips"));
  fs.writeFileSync(path.join(root, "videos", "game.mp4"), "0123456789");
  fs.writeFileSync(path.join(root, "clips", "c.mp4"), "clip");
  fs.writeFileSync(path.join(root, "Game.bvap"), "{}");
  return root;
};
const outside = path.join(base, "secret.mp4");
fs.writeFileSync(outside, "0123456789");

const unix = { skip: process.platform === "win32" };
const big = { maxBytes: 1000 };
const unsafe = (rel: string) => ({ message: `${BUNDLE_FILE_UNSAFE} ${rel}` });

test("a valid video, clip and .bvap resolve to their real path and size", async () => {
  const root = bundle();
  assert.deepEqual(await resolveBundleFile(root, "videos/game.mp4", { ...big, expectSize: 10 }),
    { path: path.join(root, "videos", "game.mp4"), size: 10 });
  assert.equal((await resolveBundleFile(root, "clips/c.mp4", big))?.size, 4);
  assert.equal((await resolveBundleFile(root, "Game.bvap", big))?.size, 2);
});

test("a file that is not there is null, not an error", async () => {
  const root = bundle();
  assert.equal(await resolveBundleFile(root, "videos/other.mp4", big), null);
  fs.rmSync(path.join(root, "clips"), { recursive: true });
  assert.equal(await resolveBundleFile(root, "clips/c.mp4", big), null);
});

test("a symlinked file is refused, even one pointing inside the bundle", unix, async () => {
  const root = bundle();
  fs.symlinkSync(outside, path.join(root, "videos", "link.mp4"));
  fs.symlinkSync(path.join(root, "videos", "game.mp4"), path.join(root, "videos", "inside.mp4"));
  await assert.rejects(resolveBundleFile(root, "videos/link.mp4", big), unsafe("videos/link.mp4"));
  await assert.rejects(resolveBundleFile(root, "videos/inside.mp4", big), unsafe("videos/inside.mp4"));
});

test("a symlinked videos/ folder is refused", unix, async () => {
  const root = bundle();
  const elsewhere = path.join(base, `elsewhere${n++}`);
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "game.mp4"), "0123456789");
  fs.rmSync(path.join(root, "videos"), { recursive: true });
  fs.symlinkSync(elsewhere, path.join(root, "videos"));
  await assert.rejects(resolveBundleFile(root, "videos/game.mp4", big), unsafe("videos/game.mp4"));
});

test("a symlinked bundle root is refused", unix, async () => {
  const root = bundle();
  const link = path.join(base, `rootlink${n++}`);
  fs.symlinkSync(root, link);
  await assert.rejects(resolveBundleFile(link, "videos/game.mp4", big), unsafe("videos/game.mp4"));
});

test("`..`, absolute paths, backslashes and other folders are refused before anything is read", async () => {
  const root = bundle();
  for (const rel of [
    "../secret.mp4", "videos/../../secret.mp4", "videos/..", outside, "/etc/hosts", "videos\\..\\x.mp4",
    "other/game.mp4", "videos/sub/game.mp4", "", "videos/", ".hidden",
  ]) {
    await assert.rejects(resolveBundleFile(root, rel, big), unsafe(rel), rel);
  }
});

test("a directory or FIFO where a file should be is refused", unix, async () => {
  const root = bundle();
  fs.mkdirSync(path.join(root, "videos", "dir.mp4"));
  execFileSync("mkfifo", [path.join(root, "videos", "fifo.mp4")]);
  await assert.rejects(resolveBundleFile(root, "videos/dir.mp4", big), unsafe("videos/dir.mp4"));
  await assert.rejects(resolveBundleFile(root, "videos/fifo.mp4", big), unsafe("videos/fifo.mp4"));
});

test("a videos file where the folder should be is refused", async () => {
  const root = bundle();
  fs.rmSync(path.join(root, "videos"), { recursive: true });
  fs.writeFileSync(path.join(root, "videos"), "not a folder");
  await assert.rejects(resolveBundleFile(root, "videos/game.mp4", big), unsafe("videos/game.mp4"));
});

test("a file over the cap is refused", async () => {
  const root = bundle();
  await assert.rejects(resolveBundleFile(root, "videos/game.mp4", { maxBytes: 9 }), unsafe("videos/game.mp4"));
  assert.ok(await resolveBundleFile(root, "videos/game.mp4", { maxBytes: 10 }));
});

test("a video whose size is not its fingerprint's is refused", async () => {
  const root = bundle();
  for (const expectSize of [9, 11]) {
    await assert.rejects(resolveBundleFile(root, "videos/game.mp4", { ...big, expectSize }),
      { message: `${BUNDLE_FILE_CHANGED} videos/game.mp4` });
  }
});
