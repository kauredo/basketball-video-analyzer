import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Fingerprint } from "./bundleManifest.ts";
import {
  IMPORT_CANCELLED, alreadyHave, findLocalMatch, planImportCopies, receivedSnapshot, resolveRecordings,
  runImport, sharedProjectName,
} from "./shareImport.ts";
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

const fp = (size: number, head = "a".repeat(64), tail = "b".repeat(64)): Fingerprint => ({ size, head, tail });
const UID = "11111111-2222-4333-8444-555555555555";

test("a v4 .bvap whose project is here hands off; .json, v3 and unknown projects import as new", () => {
  const known = (uid: string) => (uid === UID ? 7 : null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: UID }, known), 7);
  assert.equal(alreadyHave({ bvap: false, version: 4, projectUid: UID }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 3, projectUid: UID }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: null }, known), null);
  assert.equal(alreadyHave({ bvap: true, version: 4, projectUid: "99999999-2222-4333-8444-555555555555" }, known), null);
});

test("a taken project name gets the suffix, and a number when that is taken too", () => {
  const taken = new Set(["Game", "Game (shared)", "Other"]);
  const isTaken = (name: string) => taken.has(name);
  assert.equal(sharedProjectName("Final", isTaken, "(shared)"), "Final");
  assert.equal(sharedProjectName("Other", isTaken, "(shared)"), "Other (shared)");
  assert.equal(sharedProjectName("Game", isTaken, "(shared)"), "Game (shared) (2)");
});

const lookups = (over: Partial<Parameters<typeof resolveRecordings>[1]> = {}) => ({
  bundleFile: async () => null,
  fingerprint: () => null,
  localMatch: async () => null,
  ...over,
});

test("a recording in the bundle is used without asking", async () => {
  const sources = await resolveRecordings(1, lookups({
    bundleFile: async () => ({ path: "/b/videos/g.mp4", size: 5 }),
    fingerprint: () => fp(5),
    localMatch: async () => assert.fail("no local lookup once the bundle has it"),
  }));
  assert.deepEqual(sources, [{ kind: "bundle", file: { path: "/b/videos/g.mp4", size: 5 } }]);
});

test("without a bundled file, a local recording with the same fingerprint is used", async () => {
  const seenTaken: string[][] = [];
  const sources = await resolveRecordings(2, lookups({
    fingerprint: index => fp(10 + index),
    localMatch: async (fingerprint, taken) => {
      seenTaken.push([...taken]);
      return fingerprint.size === 10 ? "/local/a.mp4" : null;
    },
  }));
  assert.deepEqual(sources, [{ kind: "local", path: "/local/a.mp4" }, { kind: "pick" }]);
  assert.deepEqual(seenTaken, [[], ["/local/a.mp4"]], "a matched file is not offered to the next recording");
});

test("with neither, the recording goes to the file picker", async () => {
  assert.deepEqual(await resolveRecordings(1, lookups()), [{ kind: "pick" }]);
  assert.deepEqual(await resolveRecordings(1, lookups({ fingerprint: () => fp(1) })), [{ kind: "pick" }]);
});

test("a local file of the same size but a different head is not a match, and other sizes are never read", async () => {
  const sizes: Record<string, number> = { "/same-size.mp4": 10, "/other-size.mp4": 11, "/match.mp4": 10 };
  const read: string[] = [];
  const fingerprints: Record<string, Fingerprint> = {
    "/same-size.mp4": fp(10, "c".repeat(64)),
    "/match.mp4": fp(10),
  };
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

const sources = (dir: string) => {
  const video = path.join(dir, "game.mp4");
  const clip = path.join(dir, "c1.mp4");
  const thumb = path.join(dir, "c1-thumb.jpg");
  fs.writeFileSync(video, "video");
  fs.writeFileSync(clip, "clip");
  fs.writeFileSync(thumb, "jpg");
  return { video, clip, thumb };
};

const plan = (dir: string, copyVideos: boolean, userData: string) => {
  const { video, clip, thumb } = sources(dir);
  let id = 0;
  return planImportCopies({
    recordings: [{ path: video, size: 5, bundled: true }, { path: "/local/b.mp4", size: 0, bundled: false }],
    clips: [{ clip: { path: clip, size: 4 }, thumbnail: { path: thumb, size: 3 } }, null],
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
  assert.equal(result.copies.length, 3);
  assert.equal(result.totalBytes, 12);
});

test("use in place keeps the bundle's path and copies only the clips", () => {
  const dir = fresh();
  const result = plan(dir, false, fresh());
  assert.equal(result.paths[0], path.join(dir, "game.mp4"));
  assert.equal(result.copies.length, 2);
});

test("a name already in userData gets a number, and the import never writes over it", async () => {
  const userData = fresh();
  fs.mkdirSync(path.join(userData, "videos", UID), { recursive: true });
  fs.writeFileSync(path.join(userData, "videos", UID, "game.mp4"), "keep me");
  fs.mkdirSync(path.join(userData, "clips"));
  fs.writeFileSync(path.join(userData, "clips", "new0.mp4"), "keep me too");
  const result = plan(fresh(), true, userData);
  assert.equal(result.paths[0], path.join(userData, "videos", UID, "game (2).mp4"));
  assert.equal(result.clipFiles[0]?.output, path.join(userData, "clips", "new0 (2).mp4"));

  // A file that appears after planning is still never replaced, and never removed.
  fs.writeFileSync(path.join(userData, "videos", UID, "game (2).mp4"), "raced");
  await assert.rejects(runImport({ copies: result.copies, write: () => 1, signal: never, onProgress: quiet, tryClone: false }));
  assert.equal(fs.readFileSync(path.join(userData, "videos", UID, "game (2).mp4"), "utf8"), "raced");
  assert.equal(fs.readFileSync(path.join(userData, "videos", UID, "game.mp4"), "utf8"), "keep me");
  assert.equal(fs.readFileSync(path.join(userData, "clips", "new0.mp4"), "utf8"), "keep me too");
});

test("a finished import has every file and returns what the write returned", async () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  const project = await runImport({
    copies: result.copies, write: () => ({ id: 3 }), signal: never, onProgress: quiet, tryClone: false,
  });
  assert.deepEqual(project, { id: 3 });
  assert.equal(fs.readFileSync(result.paths[0], "utf8"), "video");
  assert.equal(fs.readFileSync(result.clipFiles[0]!.thumbnail, "utf8"), "jpg");
});

const listAll = (dir: string): string[] =>
  fs.readdirSync(dir, { recursive: true }).map(String).sort();

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
    signal: never, onProgress: quiet, tryClone: false,
  }), { message: "SQLITE_CONSTRAINT" });
  assert.equal(wrote, true);
  assert.deepEqual(listAll(userData), ["already.db"]);
});

test("a write failure keeps a clips folder that was there before", async () => {
  const userData = fresh();
  fs.mkdirSync(path.join(userData, "clips"));
  fs.writeFileSync(path.join(userData, "clips", "mine.mp4"), "mine");
  const result = plan(fresh(), false, userData);
  await assert.rejects(runImport({
    copies: result.copies, write: () => { throw new Error("boom"); }, signal: never, onProgress: quiet, tryClone: false,
  }));
  assert.deepEqual(listAll(userData), ["clips", path.join("clips", "mine.mp4")]);
});

test("cancelling mid-copy removes what was copied and never writes", { skip: process.platform === "win32" }, async () => {
  const userData = fresh();
  const result = plan(fresh(), true, userData);
  // The clips copy first, then /dev/zero never ends, so the abort lands inside it.
  const copies = [...result.copies.slice(1), { source: "/dev/zero", target: path.join(userData, "videos", UID, "zero.mp4"), size: 10 }];
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 50);
  let wrote = false;
  await assert.rejects(runImport({
    copies, write: () => { wrote = true; }, signal: abort.signal, onProgress: quiet, tryClone: false,
  }), { message: IMPORT_CANCELLED });
  assert.equal(wrote, false);
  assert.deepEqual(listAll(userData), []);
});

test("the received snapshot keeps the share id and drops the share and bundle blocks", () => {
  const raw = { version: 4, project: { uid: UID }, share: { id: UID.toUpperCase(), basedOn: null }, bundle: { version: 1 } };
  const snapshot = receivedSnapshot(raw);
  assert.deepEqual(snapshot, { id: UID, data: JSON.stringify({ version: 4, project: { uid: UID } }) });
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
  const latest = latestReceivedSnapshot(db, 1);
  assert.equal(latest?.id, UID);
  assert.equal(latest?.data, JSON.stringify({ version: 4 }));
});
