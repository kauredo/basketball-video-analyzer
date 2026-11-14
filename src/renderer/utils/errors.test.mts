import { test } from "node:test";
import assert from "node:assert/strict";
import { errorCode } from "./errors.ts";

// The renderer sees main-process throws in the form Electron's ipcRenderer.invoke builds.
const wrapped = (channel: string, code: string) =>
  new Error(`Error invoking remote method '${channel}': Error: ${code}`);

test("codes are found inside Electron's invoke wrapper", () => {
  assert.equal(errorCode(wrapped("cut-video-clip", "ERROR_FFMPEG_FAILED")), "ERROR_FFMPEG_FAILED");
  assert.equal(errorCode(wrapped("download-youtube", "INVALID_YOUTUBE_URL")), "INVALID_YOUTUBE_URL");
  assert.equal(errorCode(wrapped("load-session", "INVALID_SESSION_FILE")), "INVALID_SESSION_FILE");
});

test("bare codes are found", () => {
  assert.equal(errorCode(new Error("ERROR_NO_WRITE_ACCESS")), "ERROR_NO_WRITE_ACCESS");
  assert.equal(errorCode("DOWNLOAD_FAILED"), "DOWNLOAD_FAILED");
});

test("messages without a code give null", () => {
  assert.equal(errorCode(new Error("ENOSPC: no space left on device")), null);
  assert.equal(errorCode(wrapped("cut-video-clip", "TypeError: x is undefined")), null);
  assert.equal(errorCode(undefined), null);
});
