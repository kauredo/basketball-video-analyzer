import { test } from "node:test";
import assert from "node:assert/strict";
import { EXISTS, diffSessions, type DiffItem } from "./shareDiff.ts";
import {
  ANA, BEA, C1, C2, C3, C4, C5, D1, D2, DEFENSE, R1, R2, baseSession, clip, clipOf, edit,
} from "./shareFixtures.test.mts";

const only = (items: DiffItem[]) => {
  assert.equal(items.length, 1, JSON.stringify(items));
  return items[0];
};

test("nothing differs: no rows", () => {
  const base = baseSession();
  assert.deepEqual(diffSessions(base, base, base), { hasBase: true, items: [] });
});

test("a clip they added is new and ticked", () => {
  const base = baseSession();
  const theirs = edit(base, s => s.clips.push(clip(C5, "Backdoor", 90)));
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.token, `clip:${C5}`);
  assert.equal(item.group, "new");
  assert.equal(item.ticked, true);
});

test("a clip only they edited is changed, ticked, and lists the field", () => {
  const base = baseSession();
  const theirs = edit(base, s => { clipOf(s, C1).title = "Fast break 2"; });
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.group, "changed");
  assert.equal(item.ticked, true);
  assert.deepEqual(item.changes, [{ field: "title", mine: "Fast break", theirs: "Fast break 2" }]);
  assert.deepEqual(item.conflicts, []);
});

test("a clip only I edited shows nothing", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "Mine"; clipOf(s, C1).categoryKeys = [DEFENSE]; });
  assert.deepEqual(diffSessions(base, mine, base).items, []);
});

test("both edited different fields: no conflict, only their field is proposed", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C2).title = "A's title"; });
  const theirs = edit(base, s => { clipOf(s, C2).notes = "B's notes"; });
  const item = only(diffSessions(base, mine, theirs).items);
  assert.equal(item.group, "changed");
  assert.deepEqual(item.changes, [{ field: "notes", mine: "", theirs: "B's notes" }]);
});

test("both edited the same field differently: a conflict with both values", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A's"; clipOf(s, C1).notes = "same"; });
  const theirs = edit(base, s => { clipOf(s, C1).title = "B's"; clipOf(s, C1).status = "keep"; clipOf(s, C1).notes = "same"; });
  const item = only(diffSessions(base, mine, theirs).items);
  assert.equal(item.group, "conflict");
  assert.equal(item.ticked, true);
  assert.deepEqual(item.conflicts, [{ field: "title", mine: "A's", theirs: "B's" }]);
  assert.deepEqual(item.changes, [{ field: "status", mine: null, theirs: "keep" }], "their other field still comes along");
});

test("both changed a field to the same value: nothing", () => {
  const base = baseSession();
  const both = edit(base, s => { clipOf(s, C1).title = "Same"; s.players[0].number = "9"; });
  assert.deepEqual(diffSessions(base, both, structuredClone(both)).items, []);
});

test("a clip they deleted is a proposed deletion, unticked", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.group, "deleted");
  assert.equal(item.ticked, false);
});

test("a clip I deleted and they edited is a conflict: their version or keep it deleted", () => {
  const base = baseSession();
  const mine = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const theirs = edit(base, s => { clipOf(s, C3).notes = "look at this"; });
  const item = only(diffSessions(base, mine, theirs).items);
  assert.equal(item.group, "conflict");
  assert.deepEqual(item.conflicts, [{ field: EXISTS, mine: false, theirs: true }]);
});

test("deleted by me and untouched by them, deleted by both, or added by me only: nothing", () => {
  const base = baseSession();
  const mine = edit(base, s => {
    s.clips = s.clips.filter(row => row.uid !== C3 && row.uid !== C4);
    s.clips.push(clip(C5, "Mine only", 90));
  });
  const theirs = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C4); });
  assert.deepEqual(diffSessions(base, mine, theirs).items, []);
});

test("a category renamed on one side is a change to its name", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.categories[2].name = "Defence"; });
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.token, `category:${DEFENSE}`);
  assert.deepEqual(item.changes, [{ field: "name", mine: "Defense", theirs: "Defence" }]);
});

test("a colour differing only in case is not a change", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.categories[0].color = "#B15F43"; });
  assert.deepEqual(diffSessions(base, base, theirs).items, []);
});

test("a category they deleted is a proposed deletion even while my clips use it", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid !== DEFENSE);
    clipOf(s, C2).categoryKeys = [];
  });
  const items = diffSessions(base, base, theirs).items;
  assert.deepEqual(items.map(item => [item.token, item.group]), [
    [`category:${DEFENSE}`, "deleted"], [`clip:${C2}`, "changed"],
  ]);
});

test("a player's number changed", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.players[1].number = "12"; });
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.token, `player:${BEA}`);
  assert.deepEqual(item.changes, [{ field: "number", mine: "7", theirs: "12" }]);
});

test("tags compare as sets: the same players in another order are not a change", () => {
  const base = baseSession();
  const theirs = edit(base, s => { clipOf(s, C4).playerKeys = [BEA, ANA]; });
  assert.deepEqual(diffSessions(base, base, theirs).items, []);
});

test("a drawing edited: its shapes and replay time", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.drawings[0].data = "[]"; s.drawings[0].displaySeconds = 4; });
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.token, `drawing:${D1}`);
  assert.deepEqual(item.changes.map(change => change.field), ["data", "displaySeconds"]);
});

test("a clip moved to another recording, which they added", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second-half.mp4" });
    Object.assign(clipOf(s, C4), { recording: 1, recordingUid: R2 });
  });
  const items = diffSessions(base, base, theirs).items;
  assert.deepEqual(items.map(item => [item.token, item.group]), [[`recording:${R2}`, "new"], [`clip:${C4}`, "changed"]]);
  assert.deepEqual(items[1].changes, [{ field: "recording", mine: R1, theirs: R2 }]);
});

test("time is one field, so a pick never mixes my start with their end", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).startTime = 9; });
  const theirs = edit(base, s => { clipOf(s, C1).endTime = 20; clipOf(s, C1).duration = 10; });
  const item = only(diffSessions(base, mine, theirs).items);
  assert.deepEqual(item.conflicts, [{ field: "time", mine: [9, 15, 5], theirs: [10, 20, 10] }]);
});

test("with no base, every difference is a conflict, mine picked by default", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A's"; s.clips.push(clip(C5, "Mine only", 90)); });
  const theirs = edit(base, s => {
    clipOf(s, C2).notes = "B's";
    s.clips = s.clips.filter(row => row.uid !== C3);
    s.drawings.push({ ...s.drawings[0], uid: D2, timestamp: 40 });
  });
  const diff = diffSessions(null, mine, theirs);
  assert.equal(diff.hasBase, false);
  assert.deepEqual(diff.items.map(item => [item.token, item.group, item.conflicts.map(c => c.field)]), [
    [`clip:${C1}`, "conflict", ["title"]],
    [`clip:${C2}`, "conflict", ["notes"]],
    [`clip:${C3}`, "conflict", [EXISTS]],
    [`clip:${C5}`, "conflict", [EXISTS]],
    [`drawing:${D2}`, "conflict", [EXISTS]],
  ]);
  assert.ok(diff.items.every(item => item.changes.length === 0));
  assert.deepEqual(diff.items[2].conflicts[0], { field: EXISTS, mine: true, theirs: false });
  assert.deepEqual(diff.items[4].conflicts[0], { field: EXISTS, mine: false, theirs: true });
});

test("an item both have but the base does not: differences are conflicts", () => {
  const base = baseSession();
  const added = clip(C5, "Both", 90);
  const mine = edit(base, s => s.clips.push({ ...added, title: "A" }));
  const theirs = edit(base, s => s.clips.push({ ...added, title: "B" }));
  const item = only(diffSessions(base, mine, theirs).items);
  assert.equal(item.group, "conflict");
  assert.deepEqual(item.conflicts, [{ field: "title", mine: "A", theirs: "B" }]);
});

test("a recording they added is new", () => {
  const base = baseSession();
  const theirs = edit(base, s => s.recordings.push({ uid: R2, videoName: "second-half.mp4" }));
  const item = only(diffSessions(base, base, theirs).items);
  assert.equal(item.token, `recording:${R2}`);
  assert.equal(item.group, "new");
});

test("a row without a uid is refused", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.clips[0].uid = null; });
  assert.throws(() => diffSessions(base, base, theirs), /INVALID_SESSION_FILE/);
});
