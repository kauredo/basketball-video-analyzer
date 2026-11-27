import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest, isBundlePath, parseManifest } from "./bundleManifest.ts";
import { parseSession } from "./sessionData.ts";

const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-8444-444444444444";
const HASH = "a".repeat(64);
const fingerprint = { size: 1234, head: HASH, tail: "b".repeat(64) };
const uids = { recordings: new Set([R1, R2]), clips: new Set([C1, C2]) };

const manifest = () => buildManifest({
  recordings: [
    { uid: R1, videoFile: "game.mp4", fingerprint },
    { uid: R2, videoFile: null, fingerprint },
  ],
  clips: [
    { uid: C1, clipFile: `${C1}.mp4`, thumbnailFile: `${C1}.jpg` },
    { uid: C2, clipFile: `${C2}.mov`, thumbnailFile: null },
  ],
});

test("builds relative forward-slash paths, and fingerprints even for videos left out", () => {
  assert.deepEqual(manifest(), {
    version: 1,
    videos: { [R1]: "videos/game.mp4" },
    clips: {
      [C1]: { clip: `clips/${C1}.mp4`, thumbnail: `clips/${C1}.jpg` },
      [C2]: { clip: `clips/${C2}.mov`, thumbnail: null },
    },
    fingerprints: { [R1]: fingerprint, [R2]: fingerprint },
  });
});

test("the builder refuses a name that would leave its folder", () => {
  for (const videoFile of ["../x.mp4", "a/b.mp4", "a\\b.mp4", "..", "C:x.mp4", "CON.mp4", "x.exe", "x.MP4"]) {
    assert.throws(() => buildManifest({ recordings: [{ uid: R1, videoFile, fingerprint: null }], clips: [] }));
  }
});

test("what it builds parses back unchanged", () => {
  assert.deepEqual(parseManifest(JSON.parse(JSON.stringify(manifest())), uids), manifest());
});

test("uid keys are matched ignoring case and come back lowercase", () => {
  const parsed = parseManifest({ version: 1, videos: { [R1.toUpperCase()]: "videos/g.mp4" }, clips: {}, fingerprints: {} }, uids);
  assert.deepEqual(parsed.videos, { [R1]: "videos/g.mp4" });
});

const bad = (change: (m: Record<string, any>) => void) => {
  const m = JSON.parse(JSON.stringify(manifest()));
  change(m);
  assert.throws(() => parseManifest(m, uids), /INVALID_SESSION_FILE/);
};

test("the parser rejects paths that could leave the bundle", () => {
  for (const file of [
    "videos/../secret.mp4", "../videos/g.mp4", "videos/..", "videos/a/../../b.mp4",
    "/etc/passwd", "videos//g.mp4", "C:/videos/g.mp4", "videos/C:g.mp4",
    "videos\\g.mp4", "videos/sub\\..\\g.mp4", "\\\\server\\share\\g.mp4", "clips/g.mp4", "videos/", "",
  ]) {
    bad(m => { m.videos[R1] = file; });
  }
  bad(m => { m.clips[C1].clip = "clips/../../x.mp4"; });
  bad(m => { m.clips[C1].thumbnail = "/tmp/x.jpg"; });
  bad(m => { m.clips[C1].thumbnail = "videos/x.jpg"; });
});

test("the parser applies the shared name rule to each file name", () => {
  const names: Record<string, string> = {
    "a reserved device name": "videos/CON.mp4",
    "a reserved name without extension": "videos/nul",
    "a trailing dot": "videos/g.mp4.",
    "a trailing space": "videos/g.mp4 ",
    "a control character": "videos/g\u0001.mp4",
    "a pipe": "videos/g|1.mp4",
    "a leading dot": "videos/.g.mp4",
    "a bare extension": "videos/.mp4",
  };
  for (const [reason, file] of Object.entries(names)) {
    assert.throws(() => parseManifest({ ...manifest(), videos: { [R1]: file } }, uids), /INVALID_SESSION_FILE/, reason);
  }
});

test("the parser only accepts allowlisted, lowercase extensions", () => {
  bad(m => { m.videos[R1] = "videos/game.exe"; });
  bad(m => { m.videos[R1] = "videos/game.MP4"; });
  bad(m => { m.videos[R1] = "videos/game"; });
  bad(m => { m.videos[R1] = "videos/game.jpg"; });
  bad(m => { m.clips[C1].clip = `clips/${C1}.jpg`; });
  bad(m => { m.clips[C1].thumbnail = `clips/${C1}-thumb.mp4`; });
  bad(m => { m.clips[C1].thumbnail = `clips/${C1}-thumb.svg`; });
  const ok = JSON.parse(JSON.stringify(manifest()));
  ok.clips[C1].thumbnail = `clips/${C1}-thumb.png`;
  assert.equal(parseManifest(ok, uids).clips[C1].thumbnail, `clips/${C1}-thumb.png`);
});

test("the parser rejects uids the session does not have", () => {
  bad(m => { m.videos["55555555-5555-4555-8555-555555555555"] = "videos/x.mp4"; });
  bad(m => { m.clips[R1] = { clip: "clips/x.mp4", thumbnail: null }; });
  bad(m => { m.fingerprints[C1] = fingerprint; });
});

test("the parser rejects malformed blocks and fingerprints", () => {
  for (const value of [null, "bundle", [], 1, { version: 2, videos: {}, clips: {}, fingerprints: {} }]) {
    assert.throws(() => parseManifest(value, uids), /INVALID_SESSION_FILE/);
  }
  bad(m => { m.videos = []; });
  bad(m => { delete m.clips; });
  bad(m => { m.clips[C1] = `clips/${C1}.mp4`; });
  bad(m => { m.fingerprints[R1].size = -1; });
  bad(m => { m.fingerprints[R1].size = 1.5; });
  bad(m => { m.fingerprints[R1].head = "A".repeat(64); });
  bad(m => { m.fingerprints[R1].tail = "b".repeat(63); });
});

test("isBundlePath accepts one plain name under the folder", () => {
  assert.ok(isBundlePath("videos/Jogo 1 (2).mp4", "videos", [".mp4"]));
  assert.ok(isBundlePath("clips/Οδηγός.mp4", "clips", [".mp4"]));
  assert.ok(!isBundlePath("videos/a/b.mp4", "videos", [".mp4"]));
});

test("a .bvap file still loads as a v4 session, share and bundle blocks and all", () => {
  const session = {
    version: 4,
    exportedAt: "2026-11-27T00:00:00.000Z",
    project: { uid: "66666666-6666-4666-8666-666666666666", name: "P", videoName: "game.mp4", description: "" },
    recordings: [{ uid: R1, videoName: "game.mp4" }],
    drawings: [], players: [], categories: [], clips: [],
    share: { id: "77777777-7777-4777-8777-777777777777", basedOn: null },
    bundle: manifest(),
  };
  assert.equal(parseSession(JSON.stringify(session)).recordings[0].uid, R1);
});
