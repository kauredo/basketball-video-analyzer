import { test } from "node:test";
import assert from "node:assert/strict";
import { ffmpegRelease, licenseFiles, validateFfmpeg } from "./third-party-notices.mjs";

test("reads the release from each builder's version banner", () => {
  assert.equal(ffmpegRelease("ffmpeg version 6.0 Copyright (c) 2000-2023"), "6.0");
  assert.equal(ffmpegRelease("ffmpeg version 6.1.1-tessus  https://evermeet.cx/ffmpeg/"), "6.1.1");
  assert.equal(ffmpegRelease("ffmpeg version 6.1.1-essentials_build-www.gyan.dev"), "6.1.1");
  assert.equal(ffmpegRelease("ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/"), "7.0.2");
  assert.equal(ffmpegRelease("ffmpeg version n7.1 Copyright"), "7.1");
});

test("a git snapshot or an unreadable banner has no release", () => {
  assert.equal(ffmpegRelease("ffmpeg version N-112233-gabcdef Copyright"), null);
  assert.equal(ffmpegRelease("ffmpeg version git-2024-06-29-abc Copyright"), null);
  assert.equal(ffmpegRelease(""), null);
});

test("picks licence, copying and notice files, sorted", () => {
  assert.deepEqual(
    licenseFiles(["README.md", "NOTICE", "LICENSE-MIT", "index.js", "COPYING", "license.txt", "licensed.js"]),
    ["COPYING", "LICENSE-MIT", "NOTICE", "license.txt"]
  );
});


test("rejects nonfree builds reported by configure or the licence banner", () => {
  const banner = "ffmpeg version 8.1.3\nconfiguration: --enable-gpl --enable-version3";
  const licence = "FFmpeg is free software";
  assert.doesNotThrow(() => validateFfmpeg(banner, licence));
  assert.throws(() => validateFfmpeg(`${banner} --enable-nonfree`, licence), /nonfree/);
  assert.throws(() => validateFfmpeg(banner, "This build has nonfree parts compiled in"), /nonfree/);
  assert.throws(() => validateFfmpeg("ffmpeg version 8.1.3", licence), /Could not identify/);
});
