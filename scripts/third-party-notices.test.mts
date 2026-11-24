import { test } from "node:test";
import assert from "node:assert/strict";
import { ffmpegRelease, licenseFiles } from "./third-party-notices.mjs";

// The banners the five shipped ffmpeg-static builds print, first line only.
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
