import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  INSUFFICIENT_SPACE, SHARE_CANCELLED, SHARE_FAILED, SHARE_FILE_MISSING, SHARE_VIDEO_MISSING,
  appError, copyForShare, hasFreeSpace, mapShareError, planShareCopies, runShare, statSource, type ShareCopy,
} from "./shareBundle.ts";

test("only the app's own codes cross IPC; raw messages with local paths become the fallback", () => {
  assert.equal(appError(new Error("ERROR_BUNDLE_FILE_UNSAFE videos/a <b>.mp4"), "F").message,
    "ERROR_BUNDLE_FILE_UNSAFE videos/a <b>.mp4");
  assert.equal(appError(new Error("INVALID_SESSION_FILE"), "F").message, "INVALID_SESSION_FILE");
  assert.equal(appError(new Error("EACCES: permission denied, open '/Users/coach/x.mp4'"), "F").message, "F");
  assert.equal(appError(Object.assign(new Error("ENOSPC: /Users/coach"), { code: "ENOSPC" }), "F").message, INSUFFICIENT_SPACE);
  assert.equal(appError(Object.assign(new Error("ENOENT: /Users/coach"), { code: "ENOENT" }), "F").message, SHARE_FILE_MISSING);
  assert.equal(appError(new Error("SQLITE_CONSTRAINT: UNIQUE failed"), "F").message, "F");
  assert.equal(appError(new Error("prefix ERROR_SHARE_FAILED"), "F").message, "F");
  assert.equal(appError("not an error", "F").message, "F");
});

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-share-")));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
  const dir = path.join(root, `d${n++}`);
  fs.mkdirSync(dir);
  return dir;
};
const file = (dir: string, name: string, bytes: Buffer | string) => {
  const full = path.join(dir, name);
  fs.writeFileSync(full, bytes);
  return full;
};
const never = new AbortController().signal;
const quiet = () => {};

const share = (parent: string, copies: ShareCopy[], extra: Partial<Parameters<typeof runShare>[0]> = {}) =>
  runShare({
    parent, folderName: "Game", copies, signal: never, onProgress: quiet,
    writeBvap: folder => fs.promises.writeFile(path.join(folder, "Game.bvap"), "{}", { flag: "wx" }),
    ...extra,
  });

for (const tryClone of [true, false]) {
  test(`an existing target is never replaced (${tryClone ? "clone" : "stream"} path)`, async () => {
    const dir = fresh();
    const source = file(dir, "a.mp4", "new");
    const target = file(dir, "b.mp4", "old");
    await assert.rejects(copyForShare(source, target, never, quiet, tryClone), { code: "EEXIST" });
    assert.equal(fs.readFileSync(target, "utf8"), "old");
  });
}

test("a stream copy reports bytes that add up to the file size", async () => {
  const dir = fresh();
  const bytes = randomBytes(3 * 1024 * 1024 + 17);
  const source = file(dir, "a.mp4", bytes);
  let reported = 0;
  await copyForShare(source, path.join(dir, "b.mp4"), never, chunk => { reported += chunk; }, false);
  assert.equal(reported, bytes.length);
  assert.ok(fs.readFileSync(path.join(dir, "b.mp4")).equals(bytes));
});

test("a finished share has every file and the .bvap, and reports its last progress at 100%", async () => {
  const dir = fresh();
  const parent = fresh();
  const copies = [
    { source: file(dir, "v.mp4", "video"), target: "videos/v.mp4", size: 5 },
    { source: file(dir, "c.mp4", "clip"), target: "clips/c.mp4", size: 4 },
  ];
  const seen: number[] = [];
  const folder = await share(parent, copies, { onProgress: p => seen.push(p.copiedFiles), tryClone: false });
  assert.equal(folder, path.join(parent, "Game"));
  assert.deepEqual(fs.readdirSync(folder).sort(), ["Game.bvap", "clips", "videos"]);
  assert.equal(fs.readFileSync(path.join(folder, "videos/v.mp4"), "utf8"), "video");
  assert.equal(seen.at(-1), 2);
});

test("cancelling mid-copy rejects as cancelled and leaves no folder", { skip: process.platform === "win32" }, async () => {
  const parent = fresh();
  const abort = new AbortController();
  // /dev/zero never ends, so the abort always lands inside the copy.
  setTimeout(() => abort.abort(), 50);
  let bvap = false;
  await assert.rejects(
    share(parent, [{ source: "/dev/zero", target: "videos/zero.mp4", size: 10 }], {
      signal: abort.signal, tryClone: false, writeBvap: async () => { bvap = true; },
    }),
    { message: SHARE_CANCELLED },
  );
  assert.equal(bvap, false);
  assert.deepEqual(fs.readdirSync(parent), []);
});

test("a source that vanished gives file-missing, naming the file, and the folder goes", async () => {
  const dir = fresh();
  const parent = fresh();
  const copies = [
    { source: file(dir, "ok.mp4", "x"), target: "videos/ok.mp4", size: 1 },
    { source: path.join(dir, "gone.mp4"), target: "videos/gone.mp4", size: 1 },
  ];
  await assert.rejects(share(parent, copies), { message: `${SHARE_FILE_MISSING} gone.mp4` });
  assert.deepEqual(fs.readdirSync(parent), []);
});

test("a failure before the .bvap never writes one", async () => {
  const dir = fresh();
  const parent = fresh();
  let bvap = false;
  await assert.rejects(share(parent, [{ source: path.join(dir, "gone.mp4"), target: "clips/x.mp4", size: 1 }], {
    writeBvap: async () => { bvap = true; },
  }));
  assert.equal(bvap, false);
  assert.deepEqual(fs.readdirSync(parent), []);
});

test("a .bvap that fails to write removes the folder; ENOSPC means not enough space", async () => {
  const parent = fresh();
  const full = Object.assign(new Error("no space"), { code: "ENOSPC" });
  await assert.rejects(share(parent, [], { writeBvap: async () => { throw full; } }), { message: INSUFFICIENT_SPACE });
  assert.deepEqual(fs.readdirSync(parent), []);
});

test("a folder whose real path left the parent is not removed", async () => {
  const parent = fresh();
  const outside = fresh();
  file(outside, "keep.txt", "keep");
  await assert.rejects(share(parent, [], {
    writeBvap: async folder => {
      fs.rmSync(folder, { recursive: true });
      fs.symlinkSync(outside, folder, "dir");
      throw new Error("boom");
    },
  }), { message: SHARE_FAILED });
  assert.equal(fs.readFileSync(path.join(outside, "keep.txt"), "utf8"), "keep");
  assert.ok(fs.lstatSync(path.join(parent, "Game")).isSymbolicLink());
});

test("an existing folder of the same name is left alone", async () => {
  const parent = fresh();
  fs.mkdirSync(path.join(parent, "Game"));
  file(path.join(parent, "Game"), "mine.txt", "mine");
  await assert.rejects(share(parent, []), { message: SHARE_FAILED });
  assert.equal(fs.readFileSync(path.join(parent, "Game", "mine.txt"), "utf8"), "mine");
});

test("a failing follow-up step after the .bvap keeps the finished share", async () => {
  const parent = fresh();
  const folder = await share(parent, [], { onComplete: () => { throw new Error("snapshot failed"); } });
  assert.ok(fs.existsSync(path.join(folder, "Game.bvap")));
});

test("errno codes map to the app's messages", () => {
  assert.equal(mapShareError("ENOSPC"), INSUFFICIENT_SPACE);
  assert.equal(mapShareError("ENOENT"), SHARE_FILE_MISSING);
  assert.equal(mapShareError("EACCES"), SHARE_FAILED);
  assert.equal(mapShareError(undefined), SHARE_FAILED);
});

test("free space: 5% headroom, and a filesystem that cannot say is allowed", () => {
  const disk = (free: number) => () => ({ bavail: free, bsize: 1 });
  assert.equal(hasFreeSpace(disk(1050), 1000), true);
  assert.equal(hasFreeSpace(disk(1049), 1000), false);
  assert.equal(hasFreeSpace(disk(10), 0), true);
  assert.equal(hasFreeSpace(() => { throw new Error("ENOSYS"); }, 1e12), true);
});

test("a source must be a real file with an allowed extension, links followed", async () => {
  const dir = fresh();
  const video = file(dir, "game.MP4", "x");
  file(dir, "notes.txt", "x");
  fs.symlinkSync(path.join(dir, "notes.txt"), path.join(dir, "sneaky.mp4"));
  fs.mkdirSync(path.join(dir, "folder.mp4"));
  assert.deepEqual(await statSource(video, [".mp4"]), { path: video, size: 1 });
  assert.equal(await statSource(path.join(dir, "sneaky.mp4"), [".mp4"]), null);
  assert.equal(await statSource(path.join(dir, "folder.mp4"), [".mp4"]), null);
  assert.equal(await statSource(path.join(dir, "notes.txt"), [".mp4"]), null);
  assert.equal(await statSource("", [".mp4"]), null);
});

const files: Record<string, number> = {
  "/v/Game One.MP4": 100, "/v/game2.mov": 50, "/c/a.mp4": 7, "/c/a_thumb.jpg": 2, "/c/b.mp4": 9, "/c/up.mp4": 3,
};
const stat = async (file: string) => (file in files ? { path: file, size: files[file] } : null);
const recordings = [
  { uid: "R1", video_path: "/v/Game One.MP4", video_name: "Game One.MP4" },
  { uid: "r2", video_path: "/v/game2.mov", video_name: "game2.mov" },
];
const clips = [
  { uid: "c1", output_path: "/c/a.mp4", thumbnail_path: "/c/a_thumb.jpg" },
  { uid: "c2", output_path: "/c/b.mp4", thumbnail_path: "/c/b_thumb.jpg" },
  { uid: "c3", output_path: "" },
  { uid: "c4", output_path: "/c/gone.mp4" },
  { uid: "", output_path: "/c/a.mp4" },
  { uid: "C5-UP", output_path: "/c/up.mp4" },
];

test("the plan copies videos, clips and thumbnails, with lowercase uids and extensions", async () => {
  const plan = await planShareCopies({ recordings, clips, includeVideos: true, stat });
  assert.deepEqual(plan.copies.map(copy => copy.target), [
    "videos/Game One.mp4", "videos/game2.mov",
    "clips/c1.mp4", "clips/c1-thumb.jpg", "clips/c2.mp4", "clips/c5-up.mp4",
  ]);
  assert.deepEqual(plan.clipFiles, [
    { uid: "c1", clipFile: "c1.mp4", thumbnailFile: "c1-thumb.jpg" },
    { uid: "c2", clipFile: "c2.mp4", thumbnailFile: null },
    { uid: "c5-up", clipFile: "c5-up.mp4", thumbnailFile: null },
  ]);
  assert.deepEqual(plan.recordings, [
    { uid: "r1", videoFile: "Game One.mp4", path: "/v/Game One.MP4" },
    { uid: "r2", videoFile: "game2.mov", path: "/v/game2.mov" },
  ]);
  assert.equal(plan.totalBytes, 100 + 50 + 7 + 2 + 9 + 3);
});

test("without videos the plan copies only clips but still knows where each recording is", async () => {
  const plan = await planShareCopies({ recordings, clips, includeVideos: false, stat });
  assert.ok(plan.copies.every(copy => copy.target.startsWith("clips/")));
  assert.deepEqual(plan.recordings.map(r => [r.videoFile, r.path]), [[null, "/v/Game One.MP4"], [null, "/v/game2.mov"]]);
  assert.equal(plan.totalBytes, 7 + 2 + 9 + 3);
});

test("a missing recording stops the plan only when videos are included", async () => {
  const gone = [...recordings, { uid: "r3", video_path: "/v/lost.mp4", video_name: "Lost game.mp4" }];
  await assert.rejects(planShareCopies({ recordings: gone, clips: [], includeVideos: true, stat }),
    { message: `${SHARE_VIDEO_MISSING} Lost game.mp4` });
  const plan = await planShareCopies({ recordings: gone, clips: [], includeVideos: false, stat });
  assert.equal(plan.recordings[2].path, null);
});
