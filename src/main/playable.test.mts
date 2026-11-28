import { test } from "node:test";
import assert from "node:assert/strict";
import { convertArgs, parseProbe, playablePlan, progressSeconds } from "./playable.ts";

// Trimmed `ffmpeg -i` output from the bundled ffmpeg.
const probe = (container: string, ...streams: string[]) => parseProbe([
  `Input #0, ${container}, from 'game':`,
  "  Duration: 01:32:05.50, start: 1.460867, bitrate: 975 kb/s",
  ...streams.map((s, i) => `  Stream #0:${i}[0x10${i}]: ${s}`),
  "At least one output file must be specified",
].join("\n"));

const MP4 = "mov,mp4,m4a,3gp,3g2,mj2";
const H264 = "Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1920x1080, 30 fps";
const AAC = "Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s";

test("parses container, duration and the first video and audio codecs", () => {
  assert.deepEqual(probe("mpegts", H264, "Audio: ac3 (AC-3 / 0x332D4341), 48000 Hz"), {
    container: "mpegts", durationSeconds: 5525.5, video: "h264", audio: "ac3",
  });
});

test("cover art is not the video stream", () => {
  const art = probe(MP4, AAC, "Video: mjpeg (Baseline), yuvj420p, 600x600 (attached pic)");
  assert.equal(art.video, null);
  assert.deepEqual(playablePlan(art), { kind: "no-video" });
});

test("files the player opened in testing play as they are", () => {
  for (const file of [
    probe(MP4, H264, AAC),
    probe(MP4, "Video: hevc (Main) (hvc1 / 0x31637668), yuv420p", AAC),
    probe(MP4, H264, "Audio: pcm_s16le (sowt / 0x74776F73), 44100 Hz"),
    probe("matroska,webm", "Video: vp9 (Profile 0), yuv420p", "Audio: opus, 48000 Hz"),
    probe(MP4, H264),
  ]) assert.deepEqual(playablePlan(file), { kind: "plays" });
});

test("a camera .mts with H.264 is copied, and only its AC-3 audio re-encoded", () => {
  assert.deepEqual(playablePlan(probe("mpegts", H264, "Audio: ac3 (AC-3), 48000 Hz")),
    { kind: "convert", video: "copy", audio: "encode" });
});

test("H.264 in an AVI is copied into an MP4", () => {
  assert.deepEqual(playablePlan(probe("avi", H264, "Audio: mp3 (mp3float), 44100 Hz")),
    { kind: "convert", video: "copy", audio: "copy" });
});

test("codecs the player can't decode are re-encoded", () => {
  for (const video of ["mpeg2video (Main)", "mpeg4 (Simple Profile)", "wmv2 (WMV2)", "flv1 (flv)", "prores (HQ)"]) {
    assert.equal((playablePlan(probe(MP4, `Video: ${video}, yuv420p`, AAC)) as { video: string }).video,
      "encode", video);
  }
});

test("AC-3 audio in an MP4 plays silent, so it is re-encoded", () => {
  assert.deepEqual(playablePlan(probe(MP4, H264, "Audio: ac3, 48000 Hz")),
    { kind: "convert", video: "copy", audio: "encode" });
});

test("force re-encodes the video of a file the player refused", () => {
  assert.deepEqual(playablePlan(probe(MP4, "Video: hevc (Main), yuv420p", AAC), true),
    { kind: "convert", video: "encode", audio: "copy" });
});

test("a copied HEVC stream is tagged hvc1, and a file with no audio maps none", () => {
  const args = convertArgs({ kind: "convert", video: "copy", audio: "none" }, "hevc");
  assert.deepEqual(args.slice(args.indexOf("-c:v"), args.indexOf("-c:v") + 4), ["-c:v", "copy", "-tag:v", "hvc1"]);
  assert.ok(!args.includes("-c:a"));
});

test("a re-encode is H.264 capped at 1080p, with AAC audio", () => {
  const args = convertArgs({ kind: "convert", video: "encode", audio: "encode" }, "prores");
  assert.equal(args[args.indexOf("-c:v") + 1], "libx264");
  assert.equal(args[args.indexOf("-vf") + 1], "scale=-2:'min(1080,ih)'");
  assert.equal(args[args.indexOf("-c:a") + 1], "aac");
  assert.deepEqual(args.slice(-2), ["-f", "mp4"]);
});

test("progress seconds come from ffmpeg's time= field", () => {
  assert.equal(progressSeconds("frame= 100 fps=50 time=01:00:02.50 bitrate=1.0kbits/s"), 3602.5);
  assert.equal(progressSeconds("Press [q] to stop"), null);
});
