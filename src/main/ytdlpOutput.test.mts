import { test } from "node:test";
import assert from "node:assert/strict";
import { LineBuffer, progressPercent, lastPrintedPath, templateLiteral } from "./ytdlpOutput.ts";

test("LineBuffer keeps a split line until it is complete", () => {
  const buffer = new LineBuffer();
  assert.deepEqual(buffer.push("[download]  12."), []);
  assert.deepEqual(buffer.push("5% of 10MiB\r\n[download]  2"), ["[download]  12.5% of 10MiB"]);
  assert.deepEqual(buffer.push("0.0% of 10MiB\n"), ["[download]  20.0% of 10MiB"]);
});

test("progressPercent reads download lines only", () => {
  assert.equal(progressPercent("[download]  42.3% of ~ 12.00MiB at 1.00MiB/s ETA 00:10"), 42.3);
  assert.equal(progressPercent("[download] 100% of 12.00MiB"), 100);
  assert.equal(progressPercent("[download] Destination: /x/50% off.mp4"), null);
  assert.equal(progressPercent("[Merger] Merging formats into \"a.mp4\""), null);
});

test("lastPrintedPath takes the last non-empty line", () => {
  assert.equal(lastPrintedPath("/d/Jogo Ação.mp4\n"), "/d/Jogo Ação.mp4");
  assert.equal(lastPrintedPath("/d/a.mp4\r\n/d/b.mp4\r\n\r\n"), "/d/b.mp4");
  assert.equal(lastPrintedPath(""), null);
});

test("templateLiteral doubles percent signs", () => {
  assert.equal(templateLiteral("/tmp/100%/x.txt"), "/tmp/100%%/x.txt");
});
