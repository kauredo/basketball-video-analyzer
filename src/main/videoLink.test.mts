import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideoLink } from "./videoLink.ts";

test("accepts YouTube video links, with or without a scheme", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "www.youtube.com/watch?v=jNQXAC9IVRw&t=10s",
    "https://youtu.be/jNQXAC9IVRw",
    "https://m.youtube.com/watch?v=jNQXAC9IVRw",
    "https://www.youtube.com/shorts/abc123",
    "youtube.com:443/watch?v=jNQXAC9IVRw",
    "  https://youtu.be/jNQXAC9IVRw?si=abc\n",
    "https://www.youtube.com/watch?feature=share&v=jNQXAC9IVRw",
  ]) {
    assert.ok(parseVideoLink(link), link);
  }
});

test("http links come back as https", () => {
  assert.equal(
    parseVideoLink("http://www.youtube.com/watch?v=jNQXAC9IVRw"),
    "https://www.youtube.com/watch?v=jNQXAC9IVRw"
  );
});

test("Vimeo links become player links", () => {
  const cases: [string, string][] = [
    ["https://vimeo.com/1084537", "https://player.vimeo.com/video/1084537"],
    ["vimeo.com/1084537?share=copy", "https://player.vimeo.com/video/1084537"],
    ["https://www.vimeo.com/channels/staffpicks/1084537", "https://player.vimeo.com/video/1084537"],
    ["https://vimeo.com/1084537/ab12cd34ef", "https://player.vimeo.com/video/1084537?h=ab12cd34ef"],
    ["https://player.vimeo.com/video/1084537", "https://player.vimeo.com/video/1084537"],
    ["https://player.vimeo.com/video/1084537?h=ab12&autoplay=1", "https://player.vimeo.com/video/1084537?h=ab12"],
    ["https://vimeo.com/1084537/1234567890", "https://player.vimeo.com/video/1084537?h=1234567890"],
    ["https://vimeo.com/groups/coaches/videos/1084537", "https://player.vimeo.com/video/1084537"],
    ["http://vimeo.com/1084537?h=zz!", "https://player.vimeo.com/video/1084537"],
  ];
  for (const [link, expected] of cases) {
    assert.equal(parseVideoLink(link), expected, link);
  }
});

test("rejects anything that is not an https YouTube or Vimeo video link", () => {
  for (const link of [
    "--exec=touch /tmp/x youtube.com/watch?v=x",
    "https://evil.example/?u=youtube.com/watch?v=x",
    "https://youtube.com.evil.example/watch?v=x",
    "https://www.youtube.com/shorts/",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://www.youtube.com/channel/abc",
    "https://youtu.be/",
    "https://vimeo.com/",
    "https://vimeo.com/someuser",
    "https://vimeo.com/1084537/not-a-hash",
    "https://vimeo.com/1084537/ab12/extra",
    "https://player.vimeo.com/video/",
    "https://vimeo.com.evil.example/1084537",
    "https://vimeo.com/showcase/1084537",
    "https://vimeo.com/album/1084537",
    "https://vimeo.com/channels/x/y/1084537",
    "https://player.vimeo.com/video/abc",
    "https://player.vimeo.com/video/1084537/extra",
    "https://www.hudl.com/video/3/123/abc",
    "",
  ]) {
    assert.equal(parseVideoLink(link), null, link);
  }
});
