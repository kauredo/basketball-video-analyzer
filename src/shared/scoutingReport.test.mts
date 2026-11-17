import { test } from "node:test";
import assert from "node:assert/strict";
import { scoutingReportHtml, type ReportData, type ReportLabels } from "./scoutingReport.ts";

const labels = new Proxy({} as ReportLabels, { get: (_t, key) => `[${String(key)}]` });
const data: ReportData = {
  projectName: "Lions <away>",
  videoName: "game.mp4",
  summary: { clips: "3", totalDuration: "1:30", avgDuration: "0:30", categoriesUsed: "2" },
  byCategory: [
    { name: "Offense", color: "#B15F43", count: 2, duration: "1:00" },
    { name: "Defense", color: "javascript:x", count: 1, duration: "0:30" },
  ],
  byQuarter: [{ label: "Q1", count: 3 }],
  byPlayer: [],
  clips: [{ time: "0:12", title: "<img src=x onerror=alert(1)>", categories: "Offense", players: "", quarter: "Q1", notes: "a & b" }],
};

test("text from the project is escaped", () => {
  const html = scoutingReportHtml(data, labels, null);
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<h1>Lions &lt;away&gt;<\/h1>/);
  assert.match(html, /a &amp; b/);
});

test("bars scale to the biggest count and colours must be hex", () => {
  const html = scoutingReportHtml(data, labels, null);
  assert.match(html, /width:100%;background:#B15F43/);
  assert.match(html, /width:50%;background:#0b7972/);
  assert.ok(!html.includes("javascript:"));
});

test("a count that is not a number prints as 0", () => {
  const html = scoutingReportHtml(
    { ...data, byQuarter: [{ label: "Q2", count: "<b>9</b>" as unknown as number }] },
    labels,
    null,
  );
  assert.ok(!html.includes("<b>9</b>"));
});

test("no located clips says so, and the players section only shows with players", () => {
  const html = scoutingReportHtml(data, labels, null);
  assert.match(html, /\[noLocatedClips\]/);
  assert.ok(!html.includes("[byPlayer]"));
  const withChart = scoutingReportHtml({ ...data, byPlayer: [{ label: "7 Ana", count: 2 }] }, labels, "<svg></svg>");
  assert.match(withChart, /<div class="chart"><svg><\/svg><\/div>/);
  assert.match(withChart, /\[byPlayer\]/);
});

test("normalizeReport turns anything into strings and numbers", async () => {
  const { normalizeReport } = await import("./scoutingReport.ts");
  const { data, labels } = normalizeReport({
    data: { projectName: { evil: true }, byQuarter: [{ label: 1, count: "x" }], clips: "nope" },
    labels: { title: 42 },
  });
  assert.equal(data.projectName, "[object Object]");
  assert.deepEqual(data.byQuarter, [{ label: "1", count: 0 }]);
  assert.deepEqual(data.clips, []);
  assert.equal(labels.title, "42");
  assert.equal(labels.notes, "");
  assert.deepEqual(normalizeReport(null).data.byCategory, []);
});
