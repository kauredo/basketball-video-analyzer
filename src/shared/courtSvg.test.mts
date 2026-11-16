import { test } from "node:test";
import assert from "node:assert/strict";
import { courtSvg, COURT_LINES } from "./courtSvg.ts";

const options = { background: "#fbf8f1", lines: "#5b5b5b", text: "#222222" };

test("each dot lands at its normalized spot on the court", () => {
  const svg = courtSvg([{ x: 0.5, y: 0.1, color: "#ff0000", label: "Corner three" }], options);
  assert.match(svg, /<circle cx="250" cy="47" r="8" fill="#ff0000"/);
  assert.match(svg, /<title>Corner three<\/title>/);
});

test("every court line is drawn", () => {
  const svg = courtSvg([], options);
  assert.equal(svg.match(/<(rect|line|circle|path) /g)?.length, COURT_LINES.length + 1);
});

test("labels are escaped and colours must be hex", () => {
  const svg = courtSvg(
    [{ x: 2, y: -1, color: 'red" onload="x', label: "<script>&" }],
    { ...options, legend: [{ color: "url(#x)", label: "A & B" }] },
  );
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes("onload"));
  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.match(svg, /cx="500" cy="0"/);
  assert.match(svg, />A &amp; B<\/text>/);
});

test("a legend makes the image taller by one row per item", () => {
  const svg = courtSvg([], { ...options, legend: [{ color: "#000", label: "A" }, { color: "#111", label: "B" }] });
  assert.match(svg, /viewBox="0 0 500 538"/);
});
