import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYoutubeUrl } from "./youtubeUrl.ts";

test("accepts YouTube video links, with or without a scheme", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "www.youtube.com/watch?v=jNQXAC9IVRw&t=10s",
    "https://youtu.be/jNQXAC9IVRw",
    "https://m.youtube.com/watch?v=jNQXAC9IVRw",
    "https://www.youtube.com/shorts/abc123",
  ]) {
    assert.ok(parseYoutubeUrl(link), link);
  }
});

test("rejects anything that is not an https YouTube video link", () => {
  for (const link of [
    "--exec=touch /tmp/x youtube.com/watch?v=x",
    "https://evil.example/?u=youtube.com/watch?v=x",
    "https://youtube.com.evil.example/watch?v=x",
    "http://www.youtube.com/watch?v=x",
    "file:///etc/passwd",
    "https://www.youtube.com/channel/abc",
    "https://youtu.be/",
    "",
  ]) {
    assert.equal(parseYoutubeUrl(link), null, link);
  }
});
