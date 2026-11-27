import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BUNDLE_FILE_UNSAFE, BUNDLE_INCOMPLETE, BUNDLE_NO_FINGERPRINT, resolveBundleFile, type BundleFile,
} from "./bundleFiles.ts";
import type { Fingerprint } from "./bundleManifest.ts";
import {
  IMPORT_CANCELLED, INVALID_INPUT, SHARE_BUSY, ShareOperations, alreadyHave, findLocalMatch, planImportCopies,
  prepareNewImport, readSharedFile, receivedSnapshot, resolveBundleContents, resolveRecordings, runImport,
  sharedProjectName, type ContentLookups,
} from "./shareImport.ts";
import { SHARE_FAILED } from "./shareBundle.ts";
import { createShareSnapshotsTable, latestReceivedSnapshot, saveShareSnapshot } from "./shareSnapshots.ts";

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bva-share-import-")));
after(() => fs.rmSync(base, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
  const dir = path.join(base, `d${n++}`);
  fs.mkdirSync(dir);
  return dir;
};
const never = new AbortController().signal;
const quiet = () => {};
const unix = { skip: process.platform === "win32" };

const fp = (size: number, head = "a".repeat(64), tail = "b".repeat(64)): Fingerprint => ({ size, head, tail });
const UID = "11111111-2222-4333-8444-555555555555";
const R1 = "21111111-2222-4333-8444-555555555555";
const R2 = "31111111-2222-4333-8444-555555555555";
const C1 = "41111111-2222-4333-8444-555555555555";
const C2 = "51111111-2222-4333-8444-555555555555";
const SHARE = "61111111-2222-4333-8444-555555555555";

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(14)]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

const clip = (uid: string, recording: number, recordingUid: string) => ({
  uid, recording, recordingUid, title: "Fast break", startTime: 1, endTime: 4, duration: 3,
  categories: [], categoryUids: [], players: [], playerUids: [],
});
const v4 = (extra: Record<string, unknown> = {}) => ({
  version: 4,
  project: { uid: UID, name: "Derby", description: "" },
  recordings: [{ uid: R1, videoName: "game.mp4" }, { uid: R2, videoName: "second.mp4" }],
  categories: [], players: [], drawings: [],
  clips: [clip(C1, 0, R1), clip(C2, 1, R2)],
  ...extra,
});
const manifest = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  videos: { [R1]: "videos/game.mp4" },
  clips: { [C1]: { clip: "clips/c1.mp4", thumbnail: "clips/c1-thumb.jpg" } },
  fingerprints: { [R1]: fp(MP4.length) },
  ...extra,
});

/** A shared folder: Derby.bvap (or another name), videos/game.mp4, clips/c1.mp4 and its thumbnail. */
const sharedFolder = (session: unknown, name = "Derby.bvap") => {
  const root = fresh();
  fs.mkdirSync(path.join(root, "videos"));
  fs.mkdirSync(path.join(root, "clips"));
  fs.writeFileSync(path.join(root, "videos", "game.mp4"), MP4);
  fs.writeFileSync(path.join(root, "clips", "c1.mp4"), MP4);
  fs.writeFileSync(path.join(root, "clips", "c1-thumb.jpg"), JPEG);
  fs.writeFileSync(path.join(root, name), JSON.stringify(session));
  return { root, file: path.join(root, name) };
};

const lookups = (over: Partial<ContentLookups> = {}): ContentLookups => ({
  localPaths: () => [],
  sizeOf: async () => null,
  fingerprintOf: async () => null,
  pick: async (name, index) => `/picked/${index}-${name}`,
  isSamePath: (a, b) => a === b,
  ...over,
});

test("a v4 .bvap whose project is here hands off; .json, v3 and unknown projects import as new", () => {
  const known = (uid: string) => (uid === UID ? 7 : null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: UID }, known), 7);
  assert.equal(alreadyHave({ bvap: false, version: 4, projectUid: UID }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 3, projectUid: UID }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: null }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: R1 }, known), null);
});

test("a taken project name gets the suffix, and a number when that is taken too", () => {
  const taken = new Set(["Game", "Game (shared)", "Other"]);
  const isTaken = (name: string) => taken.has(name);
  assert.equal(sharedProjectName("Final", isTaken, "(shared)"), "Final");
  assert.equal(sharedProjectName("Other", isTaken, "(shared)"), "Other (shared)");
  assert.equal(sharedProjectName("Game", isTaken, "(shared)"), "Game (shared) (2)");
});

test("a recording in the bundle is used without asking", async () => {
  const sources = await resolveRecordings(1, {
    bundleFile: async () => ({ path: "/b/videos/g.mp4", size: 5, rel: "videos/g.mp4" }),
    fingerprint: () => fp(5),
    localMatch: async () => assert.fail("no local lookup once the bundle has it"),
  });
  assert.deepEqual(sources, [{ kind: "bundle", file: { path: "/b/videos/g.mp4", size: 5, rel: "videos/g.mp4" } }]);
});

test("with neither a bundled file nor a fingerprint match, the recording goes to the file picker", async () => {
  const none = { bundleFile: async () => null, fingerprint: () => null, localMatch: async () => null };
  assert.deepEqual(await resolveRecordings(1, none), [{ kind: "pick" }]);
  assert.deepEqual(await resolveRecordings(1, { ...none, fingerprint: () => fp(1) }), [{ kind: "pick" }]);
});

test("a failing bundle lookup rejects, and no later lookup runs", async () => {
  const calls: string[] = [];
  await assert.rejects(resolveRecordings(3, {
    bundleFile: async index => {
      calls.push(`bundle ${index}`);
      if (index === 1) throw new Error(`${BUNDLE_FILE_UNSAFE} videos/b.mp4`);
      return null;
    },
    fingerprint: index => {
      calls.push(`fingerprint ${index}`);
      return null;
    },
    localMatch: async () => null,
  }), { message: `${BUNDLE_FILE_UNSAFE} videos/b.mp4` });
  assert.deepEqual(calls, ["bundle 0", "fingerprint 0", "bundle 1"]);
});

test("a local file of the same size but a different head is not a match, and other sizes are never read", async () => {
  const sizes: Record<string, number> = { "/same-size.mp4": 10, "/other-size.mp4": 11, "/match.mp4": 10 };
  const read: string[] = [];
  const fingerprints: Record<string, Fingerprint> = { "/same-size.mp4": fp(10, "c".repeat(64)), "/match.mp4": fp(10) };
  const sizeOf = async (file: string) => sizes[file] ?? null;
  const fingerprintOf = async (file: string) => {
    read.push(file);
    return fingerprints[file] ?? null;
  };
  assert.equal(await findLocalMatch(fp(10), ["/same-size.mp4", "/other-size.mp4"], sizeOf, fingerprintOf), null);
  assert.equal(await findLocalMatch(fp(10), ["/same-size.mp4", "/other-size.mp4", "/match.mp4"], sizeOf, fingerprintOf),
    "/match.mp4");
  assert.deepEqual(read, ["/same-size.mp4", "/same-size.mp4", "/match.mp4"]);
});

test("two recordings with the same fingerprint and one local file: local, then the picker, never local twice", async () => {
  const parsed = (await readSharedFile(sharedFolder(v4()).file)).parsed;
  const picks: Array<{ index: number; taken: string[] }> = [];
  const contents = await resolveBundleContents({
    root: fresh(), parsed, manifest: { version: 1, videos: {}, clips: {}, fingerprints: { [R1]: fp(10), [R2]: fp(10) } },
  }, lookups({
    localPaths: () => ["/local/a.mp4"],
    sizeOf: async () => 10,
    fingerprintOf: async () => fp(10),
    pick: async (_name, index, _count, taken) => {
      picks.push({ index, taken });
      return "/picked/b.mp4";
    },
  }));
  assert.deepEqual(contents?.recordings, [
    { path: "/local/a.mp4", bundle: null }, { path: "/picked/b.mp4", bundle: null },
  ]);
  assert.deepEqual(picks, [{ index: 1, taken: ["/local/a.mp4"] }], "the picker can't pick the file recording 1 uses");
});

test("the local candidates leave out every path already taken", async () => {
  // Recording 0 matches /LOCAL/A; recording 1 is then offered only /local/b.
  const offered: string[][] = [];
  await resolveBundleContents({
    root: fresh(),
    parsed: (await readSharedFile(sharedFolder(v4()).file)).parsed,
    manifest: { version: 1, videos: {}, clips: {}, fingerprints: { [R1]: fp(10), [R2]: fp(10) } },
  }, lookups({
    localPaths: () => {
      offered.push([]);
      return ["/LOCAL/A.mp4", "/local/b.mp4"];
    },
    sizeOf: async file => {
      offered.at(-1)!.push(file);
      return 10;
    },
    fingerprintOf: async () => fp(10),
    pick: async () => assert.fail("both match locally"),
    isSamePath: (a, b) => a.toLowerCase() === b.toLowerCase(),
  }));
  assert.deepEqual(offered, [["/LOCAL/A.mp4"], ["/local/b.mp4"]]);
});

test("the picker's taken list holds every other recording's bundled and local file", async () => {
  const parsed = (await readSharedFile(sharedFolder(v4({
    recordings: [{ uid: R1, videoName: "game.mp4" }, { uid: R2, videoName: "second.mp4" },
      { uid: C2, videoName: "third.mp4" }],
    clips: [],
  })).file)).parsed;
  const bundled: BundleFile = { path: "/bundle/videos/game.mp4", size: MP4.length, rel: "videos/game.mp4" };
  let taken: string[] = [];
  const contents = await resolveBundleContents({
    root: fresh(), parsed,
    manifest: { version: 1, videos: { [R1]: "videos/game.mp4" }, clips: {}, fingerprints: { [R1]: fp(MP4.length), [C2]: fp(10) } },
  }, lookups({
    resolve: async () => bundled,
    localPaths: () => ["/local/third.mp4"],
    sizeOf: async () => 10,
    fingerprintOf: async () => fp(10),
    pick: async (_name, _index, _count, list) => {
      taken = list;
      return "/picked/second.mp4";
    },
  }));
  assert.deepEqual(taken, ["/bundle/videos/game.mp4", "/local/third.mp4"]);
  assert.deepEqual(contents?.recordings.map(recording => recording.path),
    ["/bundle/videos/game.mp4", "/picked/second.mp4", "/local/third.mp4"]);
  assert.equal(contents?.recordings[0].bundle, bundled);
});

test("a cancelled picker cancels the whole import", async () => {
  const parsed = (await readSharedFile(sharedFolder(v4()).file)).parsed;
  assert.equal(await resolveBundleContents({ root: fresh(), parsed, manifest: null }, lookups({ pick: async () => null })), null);
});

test("a bundled video without a fingerprint has its own code", async () => {
  const shared = await readSharedFile(sharedFolder(v4({ bundle: manifest({ fingerprints: {} }) })).file);
  await assert.rejects(resolveBundleContents(shared, lookups()), { message: `${BUNDLE_NO_FINGERPRINT} videos/game.mp4` });
});

test("clip entries: both files copied in, no thumbnail is null, a listed file that is missing is incomplete", async () => {
  const full = await readSharedFile(sharedFolder(v4({ bundle: manifest() })).file);
  const contents = await resolveBundleContents(full, lookups());
  assert.equal(contents?.clips[0]?.clip.rel, "clips/c1.mp4");
  assert.equal(contents?.clips[0]?.thumbnail?.rel, "clips/c1-thumb.jpg");
  assert.equal(contents?.clips[1], null, "a clip the bundle has no file for");
  assert.equal(contents?.recordings[0].bundle?.rel, "videos/game.mp4");

  const noThumb = await readSharedFile(sharedFolder(v4({
    bundle: manifest({ clips: { [C1]: { clip: "clips/c1.mp4", thumbnail: null } } }),
  })).file);
  assert.equal((await resolveBundleContents(noThumb, lookups()))?.clips[0]?.thumbnail, null);

  const missingThumb = sharedFolder(v4({ bundle: manifest() }));
  fs.rmSync(path.join(missingThumb.root, "clips", "c1-thumb.jpg"));
  await assert.rejects(resolveBundleContents(await readSharedFile(missingThumb.file), lookups()),
    { message: `${BUNDLE_INCOMPLETE} clips/c1-thumb.jpg` });

  const missingClip = sharedFolder(v4({ bundle: manifest() }));
  fs.rmSync(path.join(missingClip.root, "clips", "c1.mp4"));
  await assert.rejects(resolveBundleContents(await readSharedFile(missingClip.file), lookups()),
    { message: `${BUNDLE_INCOMPLETE} clips/c1.mp4` });

  const missingVideo = sharedFolder(v4({ bundle: manifest() }));
  fs.rmSync(path.join(missingVideo.root, "videos", "game.mp4"));
  await assert.rejects(resolveBundleContents(await readSharedFile(missingVideo.file), lookups()),
    { message: `${BUNDLE_INCOMPLETE} videos/game.mp4` });
});

test("readSharedFile reads a v4 .bvap's bundle and share blocks, and nothing else's", async () => {
  const bvap = await readSharedFile(sharedFolder(v4({ bundle: manifest(), share: { id: SHARE, basedOn: null } })).file);
  assert.equal(bvap.bvap, true);
  assert.deepEqual(bvap.manifest?.videos, { [R1]: "videos/game.mp4" });
  assert.equal(bvap.snapshot?.id, SHARE);
  assert.equal(JSON.parse(bvap.snapshot!.data).bundle, undefined);

  const stray = { bundle: manifest(), share: { id: SHARE } };
  const json = await readSharedFile(sharedFolder(v4(stray), "derby-session.json").file);
  assert.deepEqual([json.bvap, json.manifest, json.snapshot], [false, null, null]);

  const v3 = { ...v4(stray), version: 3 };
  for (const name of ["old.bvap", "old.json"]) {
    const read = await readSharedFile(sharedFolder(v3, name).file);
    assert.deepEqual([read.parsed.version, read.manifest, read.snapshot], [3, null, null], name);
    assert.equal(read.parsed.project.uid, null);
  }
});

test("a .bvap reached through a symlinked folder opens; its contents are still checked", unix, async () => {
  const { root } = sharedFolder(v4({ bundle: manifest() }));
  const link = path.join(base, `synced${n++}`);
  fs.symlinkSync(root, link);
  const shared = await readSharedFile(path.join(link, "Derby.bvap"));
  assert.equal(shared.root, root);
  fs.rmSync(path.join(root, "videos", "game.mp4"));
  fs.symlinkSync(path.join(root, "clips", "c1.mp4"), path.join(root, "videos", "game.mp4"));
  await assert.rejects(resolveBundleContents(shared, lookups()), { message: `${BUNDLE_FILE_UNSAFE} videos/game.mp4` });
});

test("a file that is not a session is invalid", async () => {
  const root = fresh();
  fs.writeFileSync(path.join(root, "x.bvap"), "{not json");
  await assert.rejects(readSharedFile(path.join(root, "x.bvap")), { message: "INVALID_SESSION_FILE" });
});

test("a new import keeps the snapshot only when the uids were kept, and names around a taken name", async () => {
  const shared = await readSharedFile(sharedFolder(v4({ bundle: manifest(), share: { id: SHARE } })).file);
  const contents = { recordings: [], clips: [] };
  const options = { nameTaken: (name: string) => name === "Derby", suffix: "(shared)", newUid: () => "fresh" };
  const kept = prepareNewImport(shared, contents, { ...options, uidExists: () => false });
  assert.deepEqual([kept.kind, kept.session.project.uid, kept.session.project.name, kept.snapshot?.id],
    ["new", UID, "Derby (shared)", SHARE]);
  const copy = prepareNewImport(shared, contents, { ...options, uidExists: () => true });
  assert.deepEqual([copy.session.project.uid, copy.snapshot], ["fresh", null]);
});

const file = (dir: string, name: string, bytes: Buffer): BundleFile => {
  fs.writeFileSync(path.join(dir, name), bytes);
  return { path: path.join(dir, name), size: bytes.length, rel: `clips/${name}` };
};

const plan = (bundleDir: string, copyVideos: boolean, userData: string) => {
  let id = 0;
  return planImportCopies({
    recordings: [
      { path: path.join(bundleDir, "game.mp4"), bundle: { ...file(bundleDir, "game.mp4", MP4), rel: "videos/game.mp4" } },
      { path: "/local/b.mp4", bundle: null },
    ],
    clips: [{ clip: file(bundleDir, "c1.mp4", MP4), thumbnail: file(bundleDir, "c1-thumb.jpg", JPEG) }, null],
    copyVideos,
    videosDir: path.join(userData, "videos", UID),
    clipsDir: path.join(userData, "clips"),
    exists: fs.existsSync,
    newName: () => `new${id++}`,
  });
};

test("copy mode plans videos into userData/videos/<uid> and clips into userData/clips", () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  assert.deepEqual(result.paths, [path.join(userData, "videos", UID, "game.mp4"), "/local/b.mp4"]);
  assert.deepEqual(result.clipFiles, [
    { output: path.join(userData, "clips", "new0.mp4"), thumbnail: path.join(userData, "clips", "new0-thumb.jpg") },
    null,
  ]);
  assert.deepEqual(result.copies.map(copy => [copy.name, copy.media]),
    [["videos/game.mp4", true], ["clips/c1.mp4", true], ["clips/c1-thumb.jpg", true]]);
  assert.equal(result.totalBytes, MP4.length * 2 + JPEG.length);
});

test("use in place keeps the bundle's path and copies, and counts, only the clips", () => {
  const dir = fresh();
  const result = plan(dir, false, fresh());
  assert.equal(result.paths[0], path.join(dir, "game.mp4"));
  assert.equal(result.copies.length, 2);
  assert.equal(result.totalBytes, MP4.length + JPEG.length);
});

test("duplicate names get a number, ignoring case, extensions come out lowercase, and no thumbnail is an empty path", () => {
  const dir = fresh();
  const one = fresh();
  const two = fresh();
  const userData = fresh();
  fs.mkdirSync(path.join(userData, "clips"));
  // Same case on purpose: Linux treats SAME.mp4 and same.mp4 as different files.
  fs.writeFileSync(path.join(userData, "clips", "same.mp4"), "keep");
  const names = ["same", "same", "same"];
  const result = planImportCopies({
    recordings: [
      { path: "", bundle: { ...file(one, "a.mp4", MP4), rel: "videos/a.mp4" } },
      { path: "", bundle: { ...file(two, "A.MP4", MP4), rel: "videos/A.mp4" } },
    ],
    clips: [
      { clip: file(dir, "x.MP4", MP4), thumbnail: file(dir, "x.JPEG", JPEG) },
      { clip: file(dir, "y.mp4", MP4), thumbnail: null },
    ],
    copyVideos: true,
    videosDir: path.join(userData, "videos"),
    clipsDir: path.join(userData, "clips"),
    exists: fs.existsSync,
    newName: () => names.shift()!,
  });
  assert.deepEqual(result.paths.map(p => path.basename(p)), ["a.mp4", "A (2).mp4"]);
  assert.deepEqual(result.clipFiles, [
    { output: path.join(userData, "clips", "same (2).mp4"), thumbnail: path.join(userData, "clips", "same-thumb.jpeg") },
    { output: path.join(userData, "clips", "same (3).mp4"), thumbnail: "" },
  ]);
});

test("a finished import has every file and returns what the write returned", async () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  const project = await runImport({ copies: result.copies, write: () => ({ id: 3 }), signal: never, onProgress: quiet });
  assert.deepEqual(project, { id: 3 });
  assert.ok(fs.readFileSync(result.paths[0]).equals(MP4));
  assert.ok(fs.readFileSync(result.clipFiles[0]!.thumbnail).equals(JPEG));
});

const listAll = (dir: string): string[] => fs.readdirSync(dir, { recursive: true }).map(String).sort();

test("a clip copied before a video whose target appeared is removed with the folders the import made", async () => {
  const userData = fresh();
  fs.writeFileSync(path.join(userData, "already.db"), "");
  const result = plan(fresh(), true, userData);
  const [video, clipCopy, thumb] = result.copies;
  // The video's target turns up after planning, in a folder the import did not make.
  fs.mkdirSync(path.dirname(video.target), { recursive: true });
  fs.writeFileSync(video.target, "someone else's");
  const createdVideos = path.dirname(video.target);
  await assert.rejects(runImport({
    copies: [clipCopy, thumb, video], write: () => assert.fail("never writes"), signal: never, onProgress: quiet,
  }), { message: SHARE_FAILED });
  assert.equal(fs.existsSync(clipCopy.target), false);
  assert.equal(fs.existsSync(thumb.target), false);
  assert.equal(fs.readFileSync(video.target, "utf8"), "someone else's");
  assert.deepEqual(listAll(userData), ["already.db", "videos", path.join("videos", UID), path.relative(userData, video.target)]
    .sort(), "the clips folder it made is gone; the videos folder it did not make stays");
  assert.ok(fs.existsSync(createdVideos));
});

test("a write that throws removes every copied file and the folders the import made", async () => {
  const userData = fresh();
  fs.writeFileSync(path.join(userData, "already.db"), "");
  const result = plan(fresh(), true, userData);
  let wrote = false;
  await assert.rejects(runImport({
    copies: result.copies,
    write: () => {
      wrote = true;
      assert.equal(fs.existsSync(result.paths[0]), true, "files are copied before the write");
      throw new Error("SQLITE_CONSTRAINT");
    },
    signal: never, onProgress: quiet,
  }), { message: "SQLITE_CONSTRAINT" });
  assert.equal(wrote, true);
  assert.deepEqual(listAll(userData), ["already.db"]);
});

test("a write failure keeps a clips folder that was there before", async () => {
  const userData = fresh();
  fs.mkdirSync(path.join(userData, "clips"));
  fs.writeFileSync(path.join(userData, "clips", "mine.mp4"), "mine");
  const result = plan(fresh(), false, userData);
  await assert.rejects(runImport({ copies: result.copies, write: () => { throw new Error("boom"); }, signal: never, onProgress: quiet }));
  assert.deepEqual(listAll(userData), ["clips", path.join("clips", "mine.mp4")]);
});

test("cancelling after the first file removes what was copied and never writes", async () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  const abort = new AbortController();
  let wrote = false;
  await assert.rejects(runImport({
    copies: result.copies,
    write: () => { wrote = true; },
    signal: abort.signal,
    onProgress: progress => { if (progress.copiedFiles === 1) abort.abort(); },
  }), { message: IMPORT_CANCELLED });
  assert.equal(wrote, false);
  assert.deepEqual(listAll(userData), []);
});

test("a bundle error during the copy keeps its code and name", async () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  fs.writeFileSync(result.copies[0].source, Buffer.alloc(MP4.length));
  await assert.rejects(runImport({ copies: result.copies, write: () => 1, signal: never, onProgress: quiet }),
    { message: `${BUNDLE_FILE_UNSAFE} videos/game.mp4` });
  assert.deepEqual(listAll(userData), []);
});

test("share operations: one at a time, a waiting import kept until it succeeds or is cancelled", async () => {
  const ops = new ShareOperations<string>();
  await assert.rejects(ops.finish(async () => 1), { message: INVALID_INPUT }, "nothing waiting");
  assert.equal(ops.cancel(), false, "nothing running");

  let release!: () => void;
  const running = ops.run(() => new Promise<void>(resolve => { release = resolve; }));
  ops.hold("import");
  await assert.rejects(ops.run(async () => 1), { message: SHARE_BUSY });
  await assert.rejects(ops.finish(async () => 1), { message: SHARE_BUSY });
  ops.discard();
  assert.equal(ops.waiting, "import", "discard while running keeps it");
  let idle = false;
  const waitingForIdle = ops.idle().then(() => { idle = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(idle, false, "idle waits for the running operation");
  release();
  await running;
  await waitingForIdle;
  assert.equal(idle, true);

  await assert.rejects(ops.finish(async () => { throw new Error("ERROR_INSUFFICIENT_SPACE"); }));
  assert.equal(ops.waiting, "import", "a failed import keeps it for a retry");

  await assert.rejects(ops.finish(async (_pending, signal) => {
    assert.equal(ops.cancel(), true);
    assert.equal(signal.aborted, true);
    throw new Error(IMPORT_CANCELLED);
  }));
  assert.equal(ops.waiting, null, "a cancelled import is dropped");

  ops.hold("again");
  assert.equal(await ops.finish(async pending => `${pending} done`), "again done");
  assert.equal(ops.waiting, null);
  assert.equal(ops.running, false);

  ops.hold("later");
  ops.discard();
  assert.equal(ops.waiting, null);
});

test("the received snapshot keeps the share id and drops the share and bundle blocks", () => {
  const raw = { version: 4, project: { uid: UID }, share: { id: UID.toUpperCase(), basedOn: null }, bundle: { version: 1 } };
  assert.deepEqual(receivedSnapshot(raw), { id: UID, data: JSON.stringify({ version: 4, project: { uid: UID } }) });
  assert.equal(receivedSnapshot({ version: 4 }), null);
  assert.equal(receivedSnapshot({ share: { id: "not-a-uid" } }), null);
});

test("a saved received snapshot is the one the next share names as basedOn", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
  db.exec("INSERT INTO projects (name) VALUES ('Imported')");
  createShareSnapshotsTable(db);
  const snapshot = receivedSnapshot({ version: 4, share: { id: UID }, bundle: {} })!;
  saveShareSnapshot(db, { ...snapshot, projectId: 1, direction: "received" });
  assert.equal(latestReceivedSnapshot(db, 1)?.id, UID);
  assert.equal(latestReceivedSnapshot(db, 1)?.data, JSON.stringify({ version: 4 }));
});

test("resolveBundleFile is what resolveBundleContents uses by default", async () => {
  // Guards the default wiring: a symlinked clip in a real folder must be refused.
  const { root, file: bvap } = sharedFolder(v4({ bundle: manifest() }));
  fs.rmSync(path.join(root, "clips", "c1.mp4"));
  fs.symlinkSync(path.join(root, "videos", "game.mp4"), path.join(root, "clips", "c1.mp4"));
  await assert.rejects(resolveBundleContents(await readSharedFile(bvap), lookups()),
    { message: `${BUNDLE_FILE_UNSAFE} clips/c1.mp4` });
  assert.equal(typeof resolveBundleFile, "function");
});
