import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSessions } from "./shareDiff.ts";
import { reviewSummary } from "./shareReview.ts";
import {
  ANA, BEA, C1, C2, C4, C5, DEFENSE, OFFENSE, PNR, R1, R2, baseSession, clip, clipOf, edit,
} from "./shareFixtures.test.mts";

test("summary: names and colours, no uids except in tokens, and how much still uses a deletion", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid !== DEFENSE && cat.uid !== OFFENSE && cat.uid !== PNR);
    for (const row of s.clips) row.categoryKeys = [];
    s.players[1].number = "12";
  });
  const review = reviewSummary(diffSessions(base, base, theirs), base, theirs, new Set());
  const row = (token: string) => review.rows.find(entry => entry.token === token)!;
  assert.equal(row(`category:${DEFENSE}`).inUse, 1, "one clip");
  assert.equal(row(`category:${OFFENSE}`).inUse, 3, "two clips and the subcategory under it");
  assert.deepEqual(row(`category:${DEFENSE}`).preview, { title: "Defense", color: "#3b7b9b", detail: undefined });
  assert.deepEqual(row(`clip:${C1}`).changes, [{
    field: "categories",
    mine: { type: "tags", tags: [{ name: "Offense", color: "#b15f43" }] },
    theirs: { type: "tags", tags: [] },
  }]);
  assert.deepEqual(row(`player:${BEA}`).changes,
    [{ field: "number", mine: { type: "text", text: "7" }, theirs: { type: "text", text: "12" } }]);
  const text = JSON.stringify(review.rows.map(({ token, ...entry }) => entry));
  assert.ok(![OFFENSE, PNR, DEFENSE, ANA, BEA, R1, C1].some(id => text.includes(id)), text);
});

test("summary: a clip needs a re-cut when it is new or moved and the share brought no file for it", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    s.clips.push(clip(C5, "New", 90));
    clipOf(s, C1).endTime = 20;
    Object.assign(clipOf(s, C4), { recording: 1, recordingUid: R2 });
    s.clips[1].title = "Only a title";
  });
  const recut = (bundled: string[]) => Object.fromEntries(
    reviewSummary(diffSessions(base, base, theirs), base, theirs, new Set(bundled)).rows
      .filter(row => row.kind === "clip").map(row => [row.token, row.recut]));
  assert.deepEqual(recut([]), {
    [`clip:${C1}`]: true, [`clip:${C2}`]: false, [`clip:${C4}`]: true, [`clip:${C5}`]: true,
  });
  assert.deepEqual(Object.values(recut([C1, C4, C5])), [false, false, false, false]);
});
