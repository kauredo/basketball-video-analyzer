import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BUNDLE_FILE_CHANGED, BUNDLE_FILE_UNSAFE, BUNDLE_INCOMPLETE, copyBundleFile, hasMediaSignature, openNoFollow,
  readBundleText, resolveBundleFile,
} from "./bundleFiles.ts";

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-bundle-files-")));
after(() => fs.rmSync(base, { recursive: true, force: true }));
let n = 0;

/** A real-looking mp4 head: a 24-byte ftyp box, then padding. */
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(14)]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

/** A bundle folder with videos/game.mp4 (MP4.length bytes), clips/c.mp4, clips/c-thumb.jpg and Game.bvap. */
const bundle = () => {
  const root = path.join(base, `b${n++}`);
  fs.mkdirSync(path.join(root, "videos"), { recursive: true });
  fs.mkdirSync(path.join(root, "clips"));
  fs.writeFileSync(path.join(root, "videos", "game.mp4"), MP4);
  fs.writeFileSync(path.join(root, "clips", "c.mp4"), MP4);
  fs.writeFileSync(path.join(root, "clips", "c-thumb.jpg"), JPEG);
  fs.writeFileSync(path.join(root, "Game.bvap"), "{}");
  return root;
};
const outside = path.join(base, "secret.mp4");
fs.writeFileSync(outside, MP4);

const unix = { skip: process.platform === "win32" };
const big = { maxBytes: 1000 };
const media = { maxBytes: 1000, media: true };
const unsafe = (rel: string) => ({ message: `${BUNDLE_FILE_UNSAFE} ${rel}` });
const never = new AbortController().signal;
const quiet = () => {};

test("a valid video, clip, thumbnail and .bvap resolve to their real path, size and bundle path", async () => {
  const root = bundle();
  assert.deepEqual(await resolveBundleFile(root, "videos/game.mp4", { ...media, expectSize: MP4.length }),
    { path: path.join(root, "videos", "game.mp4"), size: MP4.length, rel: "videos/game.mp4" });
  assert.equal((await resolveBundleFile(root, "clips/c.mp4", media)).size, MP4.length);
  assert.equal((await resolveBundleFile(root, "clips/c-thumb.jpg", media)).size, JPEG.length);
  assert.equal(await readBundleText(root, "Game.bvap", 1000), "{}");
});

test("a file the share lists but the folder lacks is incomplete", async () => {
  const root = bundle();
  await assert.rejects(resolveBundleFile(root, "videos/other.mp4", big), { message: `${BUNDLE_INCOMPLETE} videos/other.mp4` });
  fs.rmSync(path.join(root, "clips"), { recursive: true });
  await assert.rejects(resolveBundleFile(root, "clips/c.mp4", big), { message: `${BUNDLE_INCOMPLETE} clips/c.mp4` });
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
  fs.writeFileSync(path.join(elsewhere, "game.mp4"), MP4);
  fs.rmSync(path.join(root, "videos"), { recursive: true });
  fs.symlinkSync(elsewhere, path.join(root, "videos"));
  await assert.rejects(resolveBundleFile(root, "videos/game.mp4", big), unsafe("videos/game.mp4"));
});

test("a symlinked bundle root is refused here; readSharedFile resolves the folder first", unix, async () => {
  const root = bundle();
  const link = path.join(base, `rootlink${n++}`);
  fs.symlinkSync(root, link);
  await assert.rejects(resolveBundleFile(link, "videos/game.mp4", big), unsafe("videos/game.mp4"));
});

test("a hard link is refused, inside the bundle or out", unix, async () => {
  const root = bundle();
  fs.linkSync(outside, path.join(root, "videos", "hard.mp4"));
  await assert.rejects(resolveBundleFile(root, "videos/hard.mp4", big), unsafe("videos/hard.mp4"));
  await assert.rejects(resolveBundleFile(root, "Game.bvap", big).then(() => {
    fs.linkSync(path.join(root, "Game.bvap"), path.join(root, "clips", "copy.jpg"));
    return readBundleText(root, "Game.bvap", 1000);
  }), unsafe("Game.bvap"));
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
  await assert.rejects(resolveBundleFile(root, "videos/game.mp4", { maxBytes: MP4.length - 1 }), unsafe("videos/game.mp4"));
  assert.ok(await resolveBundleFile(root, "videos/game.mp4", { maxBytes: MP4.length }));
});

test("a video whose size is not its fingerprint's is refused", async () => {
  const root = bundle();
  for (const expectSize of [MP4.length - 1, MP4.length + 1]) {
    await assert.rejects(resolveBundleFile(root, "videos/game.mp4", { ...big, expectSize }),
      { message: `${BUNDLE_FILE_CHANGED} videos/game.mp4` });
  }
});

test("a playlist or any other bytes under a video or image name is refused", async () => {
  const root = bundle();
  fs.writeFileSync(path.join(root, "videos", "playlist.mp4"), "#EXTM3U\n#EXT-X-VERSION:3\nhttp://example.com/a.ts\n");
  fs.writeFileSync(path.join(root, "clips", "fake.jpg"), MP4);
  await assert.rejects(resolveBundleFile(root, "videos/playlist.mp4", media), unsafe("videos/playlist.mp4"));
  await assert.rejects(resolveBundleFile(root, "clips/fake.jpg", media), unsafe("clips/fake.jpg"));
  // Without `media` (the .bvap) the bytes are not checked.
  assert.ok(await resolveBundleFile(root, "videos/playlist.mp4", big));
});

test("each container and image format is recognised by its own magic bytes only", () => {
  const cases: Array<[string, Buffer]> = [
    [".mp4", MP4], [".mov", MP4], [".m4v", MP4],
    [".mkv", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1])], [".webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1])],
    [".avi", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("AVI LIST")])],
    [".wmv", Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6])],
    [".flv", Buffer.from("FLV\x01")],
    [".jpg", JPEG], [".jpeg", JPEG],
    [".png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
  ];
  for (const [extension, head] of cases) {
    assert.equal(hasMediaSignature(head, extension), true, extension);
    assert.equal(hasMediaSignature(head, extension.toUpperCase()), true, `${extension} upper`);
    for (const [other, otherHead] of cases) {
      if (otherHead !== head && !otherHead.equals(head)) assert.equal(hasMediaSignature(otherHead, extension), false, `${other} as ${extension}`);
    }
  }
  assert.equal(hasMediaSignature(Buffer.from("RIFF\0\0\0\0WAVE"), ".avi"), false);
  assert.equal(hasMediaSignature(Buffer.from("ftyp"), ".mp4"), false, "ftyp must be at offset 4");
  for (const box of ["moov", "wide", "mdat", "free", "skip"]) {
    assert.equal(hasMediaSignature(Buffer.concat([Buffer.from([0, 0, 0, 8]), Buffer.from(box)]), ".mov"), true, `QuickTime ${box} atom`);
  }
  assert.equal(hasMediaSignature(Buffer.from("#EXTM3U\n#EXT-X-VERSION:3"), ".mp4"), false, "an HLS playlist is not a video");
  assert.equal(hasMediaSignature(MP4, ".txt"), false);
  assert.equal(hasMediaSignature(Buffer.alloc(0), ".png"), false);
});

const copyOf = (root: string, rel: string, size: number, target = path.join(base, `t${n++}.mp4`)) =>
  ({ source: path.join(root, ...rel.split("/")), target, size, name: rel, media: true });

test("a checked file copies byte for byte", async () => {
  const root = bundle();
  const copy = copyOf(root, "videos/game.mp4", MP4.length);
  let reported = 0;
  await copyBundleFile(copy, never, bytes => { reported += bytes; });
  assert.ok(fs.readFileSync(copy.target).equals(MP4));
  assert.equal(reported, MP4.length);
});

test("a file swapped for a symlink after it was checked is refused at copy time", unix, async () => {
  const root = bundle();
  await resolveBundleFile(root, "videos/game.mp4", { ...media, expectSize: MP4.length });
  // A plain one-link file of the same size and bytes, so only the symlink can give it away.
  const elsewhere = path.join(base, `plain${n++}.mp4`);
  fs.writeFileSync(elsewhere, MP4);
  fs.rmSync(path.join(root, "videos", "game.mp4"));
  fs.symlinkSync(elsewhere, path.join(root, "videos", "game.mp4"));
  const copy = copyOf(root, "videos/game.mp4", MP4.length);
  await assert.rejects(copyBundleFile(copy, never, quiet), unsafe("videos/game.mp4"));
  assert.equal(fs.existsSync(copy.target), false);
});

test("without O_NOFOLLOW (Windows) an lstat right before the open still refuses a symlink", unix, async () => {
  const root = bundle();
  fs.symlinkSync(outside, path.join(root, "videos", "link.mp4"));
  await assert.rejects(openNoFollow(path.join(root, "videos", "link.mp4"), null), { code: "ELOOP" });
  await assert.rejects(copyBundleFile(copyOf(root, "videos/link.mp4", MP4.length), never, quiet, null),
    unsafe("videos/link.mp4"));
});

test("a file hard-linked, grown or rewritten after it was checked is refused at copy time", unix, async () => {
  const root = bundle();
  fs.linkSync(path.join(root, "clips", "c.mp4"), path.join(base, `keep${n++}.mp4`));
  await assert.rejects(copyBundleFile(copyOf(root, "clips/c.mp4", MP4.length), never, quiet), unsafe("clips/c.mp4"));

  fs.appendFileSync(path.join(root, "videos", "game.mp4"), "more");
  await assert.rejects(copyBundleFile(copyOf(root, "videos/game.mp4", MP4.length), never, quiet),
    { message: `${BUNDLE_FILE_CHANGED} videos/game.mp4` });

  const other = bundle();
  fs.writeFileSync(path.join(other, "videos", "game.mp4"), Buffer.alloc(MP4.length));
  await assert.rejects(copyBundleFile(copyOf(other, "videos/game.mp4", MP4.length), never, quiet), unsafe("videos/game.mp4"));
});

test("a copy never replaces an existing target", async () => {
  const root = bundle();
  const target = path.join(base, `existing${n++}.mp4`);
  fs.writeFileSync(target, "keep");
  await assert.rejects(copyBundleFile(copyOf(root, "videos/game.mp4", MP4.length, target), never, quiet), { code: "EEXIST" });
  assert.equal(fs.readFileSync(target, "utf8"), "keep");
});
