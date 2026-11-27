import { test } from "node:test";
import assert from "node:assert/strict";
import { EXISTS, diffSessions, type ShareDiff } from "./shareDiff.ts";
import {
  classifyShare, copyChoice, mergeNeeds, planMerge, planMergeCopies, sessionsMatch, validateSelections,
  type MergePlan, type MergeSelections,
} from "./shareMerge.ts";
import type { ShareSnapshot } from "./shareSnapshots.ts";
import type { ParsedSession } from "./sessionData.ts";
import type { BundledClip, ImportRecording } from "./shareImport.ts";
import {
  ANA, BEA, C1, C2, C3, C4, C5, CAT, D1, DEFENSE, OFFENSE, PNR, PRESS, R1, R2, baseSession, clip, clipOf, edit, uid,
} from "./shareFixtures.test.mts";

/** Ticks every row the diff ticks by default, with the given picks. */
export const defaults = (diff: ShareDiff, choices: Record<string, Record<string, "mine" | "theirs">> = {}): MergeSelections =>
  validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, item.ticked])),
    choices,
  });
const tick = (diff: ShareDiff, tokens: string[], choices = {}) =>
  validateSelections(diff, { selected: Object.fromEntries(tokens.map(token => [token, true])), choices });
const tickAll = (diff: ShareDiff) => tick(diff, diff.items.map(item => item.token));

const plan = (base: ParsedSession | null, mine: ParsedSession, theirs: ParsedSession,
  pick: (diff: ShareDiff) => MergeSelections = diff => defaults(diff)) => {
  const diff = diffSessions(base, mine, theirs);
  return planMerge(diff, mine, theirs, pick(diff));
};
const opList = (merge: MergePlan) => merge.ops.map(op => `${op.op} ${op.kind}:${op.uid}`);

const snapshots: Record<string, ShareSnapshot> = {
  sent1: { id: "sent1", project_id: 1, direction: "sent", data: "{}", created_at: "" },
  sent2: { id: "sent2", project_id: 2, direction: "sent", data: "{}", created_at: "" },
  got1: { id: "got1", project_id: 1, direction: "received", data: "{}", created_at: "" },
  got2: { id: "got2", project_id: 2, direction: "received", data: "{}", created_at: "" },
};
const getSnapshot = (id: string) => snapshots[id] ?? null;
const share = (id: string | null, basedOn: string | null) =>
  ({ snapshot: id ? { id, data: "{}" } : null, basedOn });

test("classify: the base is only a sent snapshot of this project", () => {
  assert.equal((classifyShare(share("new", "sent1"), 1, getSnapshot) as { base: ShareSnapshot }).base?.id, "sent1");
  for (const basedOn of ["sent2", "got1", "got2", "gone", null]) {
    assert.deepEqual(classifyShare(share("new", basedOn), 1, getSnapshot),
      { kind: "review", base: null, snapshot: { id: "new", data: "{}" } }, String(basedOn));
  }
  assert.deepEqual(classifyShare(share(null, "sent1"), 1, getSnapshot).kind, "review");
});

test("classify: a share received here already is applied; any other taken id is refused", () => {
  assert.deepEqual(classifyShare(share("got1", "sent1"), 1, getSnapshot), { kind: "applied" });
  for (const id of ["sent1", "sent2", "got2"]) {
    assert.throws(() => classifyShare(share(id, "sent1"), 1, getSnapshot), /ERROR_SHARE_ID_TAKEN/, id);
  }
});

test("selections: unknown rows, fields that are not in conflict and bad values are refused", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A"; });
  const theirs = edit(base, s => { clipOf(s, C1).title = "B"; clipOf(s, C2).notes = "n"; });
  const diff = diffSessions(base, mine, theirs);
  const c1 = `clip:${C1}`;
  const ok = validateSelections(diff, { selected: { [c1]: true, [`clip:${C2}`]: false }, choices: { [c1]: { title: "theirs" } } });
  assert.deepEqual([...ok.selected], [c1]);
  assert.equal(ok.choices.get(c1)?.get("title"), "theirs");

  const refused = [
    null, [], { selected: {} }, { choices: {} },
    { selected: { "clip:nope": true }, choices: {} },
    { selected: { [c1]: "yes" }, choices: {} },
    { selected: {}, choices: { [c1]: { title: "both" } } },
    { selected: {}, choices: { [c1]: { notes: "theirs" } } },
    { selected: {}, choices: { [`clip:${C2}`]: { notes: "theirs" } } },
    { selected: {}, choices: { [c1]: "theirs" } },
    JSON.parse(`{"selected":{"__proto__":true},"choices":{}}`),
  ];
  for (const input of refused) assert.throws(() => validateSelections(diff, input), /ERROR_INVALID_INPUT/, JSON.stringify(input));
});

test("plan: only ticked rows become operations", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.clips.push(clip(C5, "Backdoor", 90));
    clipOf(s, C1).title = "Renamed";
  });
  const merge = plan(base, base, theirs, diff => tick(diff, [`clip:${C5}`]));
  assert.deepEqual(opList(merge), [`insert clip:${C5}`]);
  assert.deepEqual(merge.clipFiles, [C5]);
});

test("plan: conflict picks are honoured; mine leaves the row alone, their other fields still come", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C1).title = "A"; clipOf(s, C2).title = "A2"; });
  const theirs = edit(base, s => {
    clipOf(s, C1).title = "B";
    clipOf(s, C2).title = "B2";
    clipOf(s, C2).status = "keep";
  });
  const merge = plan(base, mine, theirs, diff => defaults(diff, { [`clip:${C1}`]: { title: "theirs" } }));
  assert.deepEqual(merge.ops, [
    { op: "update", kind: "clip", uid: C1, fields: { title: "B" } },
    { op: "update", kind: "clip", uid: C2, fields: { status: "keep" } },
  ]);
});

test("plan: an unticked deletion is untouched; a ticked one deletes", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  assert.deepEqual(opList(plan(base, base, theirs)), []);
  assert.deepEqual(opList(plan(base, base, theirs, diff => tick(diff, [`clip:${C3}`]))), [`delete clip:${C3}`]);
});

test("plan: they deleted what I edited: unticked stays, theirs deletes", () => {
  const base = baseSession();
  const mine = edit(base, s => { clipOf(s, C3).notes = "mine"; });
  const theirs = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  assert.deepEqual(opList(plan(base, mine, theirs)), []);
  assert.deepEqual(opList(plan(base, mine, theirs, diff =>
    tick(diff, [`clip:${C3}`], { [`clip:${C3}`]: { [EXISTS]: "theirs" } }))), [`delete clip:${C3}`]);
});

test("plan: a deleted category still used by clips after the merge is kept, and so is its parent", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid === DEFENSE);
    for (const row of s.clips) row.categoryKeys = [];
  });
  const categoriesOnly = (diff: ShareDiff) =>
    tick(diff, diff.items.filter(item => item.kind === "category").map(item => item.token));
  const merge = plan(base, base, theirs, categoriesOnly);
  assert.deepEqual(opList(merge), []);
  assert.deepEqual(merge.kept.sort(), [`category:${OFFENSE}`, `category:${PNR}`].sort());

  const both = plan(base, base, theirs, tickAll);
  assert.deepEqual(both.ops.filter(op => op.op === "delete").map(op => op.uid), [PNR, OFFENSE]);
  assert.deepEqual(both.kept, []);
});

test("plan: a parent no clip uses stays while a child it holds stays", () => {
  const base = baseSession();
  const mine = edit(base, s => { for (const row of s.clips) if (row.uid !== C4) row.categoryKeys = []; });
  const theirs = edit(mine, s => {
    s.categories = s.categories.filter(cat => cat.uid === DEFENSE);
    clipOf(s, C4).categoryKeys = [];
  });
  const merge = plan(base, mine, theirs, diff =>
    tick(diff, diff.items.filter(item => item.kind === "category").map(item => item.token)));
  assert.deepEqual(opList(merge), []);
  assert.deepEqual(merge.kept.sort(), [`category:${OFFENSE}`, `category:${PNR}`].sort());
});

test("plan: a ticked clip brings the new recording, tags and players it points at, even unticked", () => {
  const base = baseSession();
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    s.categories.push({ uid: PRESS, key: PRESS, parentKey: null, name: "Press", color: "#123456", description: "" });
    s.players.push({ uid: CAT, key: CAT, name: "Cat", number: null });
    s.clips.push(clip(C5, "Second half", 5, { recording: 1, recordingUid: R2, categoryKeys: [PRESS], playerKeys: [CAT] }));
    clipOf(s, C1).playerKeys = [ANA, CAT];
  });
  const merge = plan(base, base, theirs, diff => tick(diff, [`clip:${C5}`, `clip:${C1}`]));
  assert.deepEqual(opList(merge), [
    `insert recording:${R2}`, `insert category:${PRESS}`, `insert player:${CAT}`,
    `insert clip:${C5}`, `update clip:${C1}`,
  ]);
  assert.deepEqual(merge.newRecordings, [R2]);
});

test("plan: a new subcategory brings its parent, new or deleted here; parents are inserted first", () => {
  const base = baseSession();
  const child = { uid: uid(14), key: uid(14), parentKey: PRESS, name: "Full court", color: "#123456", description: "" };
  const theirs = edit(base, s => {
    s.categories.push(child, { uid: PRESS, key: PRESS, parentKey: null, name: "Press", color: "#654321", description: "" });
  });
  assert.deepEqual(opList(plan(base, base, theirs, diff => tick(diff, [`category:${uid(14)}`]))),
    [`insert category:${PRESS}`, `insert category:${uid(14)}`]);

  // I deleted Offense; their new child under it brings it back.
  const mine = edit(base, s => {
    s.categories = s.categories.filter(cat => cat.uid !== OFFENSE && cat.uid !== PNR);
    for (const row of s.clips) row.categoryKeys = row.categoryKeys.filter(key => key === DEFENSE);
  });
  const theirsUnder = edit(base, s => s.categories.push({ ...child, parentKey: OFFENSE }));
  assert.deepEqual(opList(plan(base, mine, theirsUnder, diff => tick(diff, [`category:${uid(14)}`]))),
    [`insert category:${OFFENSE}`, `insert category:${uid(14)}`]);
});

test("plan: a parent change that would loop is kept as is and reported; their other changes still apply", () => {
  const base = baseSession();
  // A put Defense under Offense; B put Offense under Defense and recoloured it.
  const mine = edit(base, s => { s.categories[2].parentKey = OFFENSE; });
  const theirs = edit(base, s => { s.categories[0].parentKey = DEFENSE; s.categories[0].color = "#000000"; });
  const merge = plan(base, mine, theirs);
  assert.deepEqual(merge.ops, [{ op: "update", kind: "category", uid: OFFENSE, fields: { color: "#000000" } }]);
  assert.deepEqual(merge.heldBack, [{ name: "Offense", reason: "loop" }]);

  const self = edit(base, s => { s.categories[2].parentKey = DEFENSE; });
  assert.deepEqual(plan(base, base, self).heldBack, [{ name: "Defense", reason: "loop" }]);
  assert.deepEqual(plan(base, base, self).ops, []);
});

test("plan: a parent change that would nest categories two levels deep is kept as is and reported", () => {
  const base = edit(baseSession(), s => s.categories.push(
    { uid: PRESS, key: PRESS, parentKey: null, name: "Press", color: "#123456", description: "" }));
  // A put Press under Defense; B put Defense under Offense and renamed it.
  const mine = edit(base, s => { s.categories[3].parentKey = DEFENSE; });
  const theirs = edit(base, s => { s.categories[2].parentKey = OFFENSE; s.categories[2].name = "D"; });
  const merge = plan(base, mine, theirs);
  assert.deepEqual(merge.ops, [{ op: "update", kind: "category", uid: DEFENSE, fields: { name: "D" } }]);
  assert.deepEqual(merge.heldBack, [{ name: "Defense", reason: "depth" }]);

  // Offense has Pick & Roll under it; moving Offense under Defense would give a child a child.
  const moved = plan(base, base, edit(base, s => { s.categories[0].parentKey = DEFENSE; }));
  assert.deepEqual(moved.ops, []);
  assert.deepEqual(moved.heldBack, [{ name: "Offense", reason: "depth" }]);

  // One level is fine.
  assert.deepEqual(plan(base, base, edit(base, s => { s.categories[3].parentKey = DEFENSE; })).heldBack, []);
});

test("plan: a rename onto a name that is taken is kept as is and reported", () => {
  const base = baseSession();
  const theirs = edit(base, s => { s.players[1].name = "Ana"; s.players[1].number = "12"; });
  const merge = plan(base, base, theirs);
  assert.deepEqual(merge.ops, [{ op: "update", kind: "player", uid: BEA, fields: { number: "12" } }]);
  assert.deepEqual(merge.heldBack, [{ name: "Bea", to: "Ana", reason: "name" }]);

  const ontoNew = edit(base, s => {
    s.players.push({ uid: CAT, key: CAT, name: "Dee", number: null });
    s.players[1].name = "Dee";
  });
  assert.deepEqual(plan(base, base, ontoNew).heldBack, [{ name: "Bea", to: "Dee", reason: "name" }],
    "onto the name of a player they add");

  const swap = edit(base, s => { s.players[0].name = "Bea"; s.players[1].name = "Ana"; });
  const swapped = plan(base, base, swap);
  assert.deepEqual(swapped.ops, []);
  assert.deepEqual(swapped.heldBack.map(entry => entry.name).sort(), ["Ana", "Bea"]);

  // Moving Pick & Roll to the top level, next to another top-level "Pick & Roll".
  const mine = edit(base, s => s.categories.push(
    { uid: PRESS, key: PRESS, parentKey: null, name: "Pick & Roll", color: "#123456", description: "" }));
  const moved = edit(base, s => { s.categories[1].parentKey = null; });
  const merge2 = plan(base, mine, moved);
  assert.deepEqual(merge2.ops, []);
  assert.deepEqual(merge2.heldBack, [{ name: "Pick & Roll", to: "Pick & Roll", reason: "name" }]);
});

test("plan: their cut file is taken only when the clip ends up with their time and their recording", () => {
  const base = baseSession();
  const mine = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    Object.assign(clipOf(s, C2), { recording: 1, recordingUid: R2 });
  });
  const theirs = edit(base, s => {
    s.recordings.push({ uid: R2, videoName: "second.mp4" });
    clipOf(s, C1).endTime = 20;
    clipOf(s, C2).endTime = 40;
  });
  const merge = plan(base, mine, theirs);
  assert.deepEqual(opList(merge), [`update clip:${C1}`, `update clip:${C2}`]);
  assert.deepEqual(merge.clipFiles, [C1], "clip 2 keeps my recording, so it waits for a re-cut");
});

test("plan: the project's first recording is never deleted", () => {
  const base = baseSession();
  const merge = plan(null, base, edit(base, s => {
    s.recordings = [{ uid: R2, videoName: "other.mp4" }];
    s.clips = [];
    s.drawings = [];
  }), diff => validateSelections(diff, {
    selected: Object.fromEntries(diff.items.map(item => [item.token, true])),
    choices: Object.fromEntries(diff.items.map(item => [item.token, { [item.conflicts[0].field]: "theirs" }])),
  }));
  assert.ok(merge.kept.includes(`recording:${R1}`));
  assert.ok(!merge.ops.some(op => op.op === "delete" && op.kind === "recording"));
});

test("plan: I deleted, they edited: theirs restores it, mine keeps it deleted", () => {
  const base = baseSession();
  const mine = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const theirs = edit(base, s => { clipOf(s, C3).notes = "look"; });
  assert.deepEqual(opList(plan(base, mine, theirs)), []);
  assert.deepEqual(opList(plan(base, mine, theirs, diff => defaults(diff, { [`clip:${C3}`]: { [EXISTS]: "theirs" } }))),
    [`insert clip:${C3}`]);
});

test("needs: recordings I lack that their rows sit on, and clips that are new, restored or moved", () => {
  const base = baseSession();
  // The base had R2 and I removed it; their clip on it is new, the recording itself is no diff row.
  const withR2 = edit(base, s => s.recordings.push({ uid: R2, videoName: "second.mp4" }));
  const mine = edit(base, s => { s.clips = s.clips.filter(row => row.uid !== C3); });
  const theirs = edit(withR2, s => {
    s.clips.push(clip(C5, "New", 90, { recording: 1, recordingUid: R2 }));
    clipOf(s, C3).notes = "edited";
    clipOf(s, C1).endTime = 20;
    clipOf(s, C2).title = "Only the title";
  });
  const diff = diffSessions(withR2, mine, theirs);
  assert.ok(!diff.items.some(item => item.kind === "recording"));
  assert.deepEqual(mergeNeeds(diff, mine, theirs), { recordings: [R2], clips: [C1, C3, C5] });
});

const bundle = (name: string, size: number) => ({ path: `/b/${name}`, size, rel: name });

test("copy choice: asked only when a ticked new recording comes in the bundle", () => {
  const merge: MergePlan = { ops: [], kept: [], heldBack: [], newRecordings: [R2], clipFiles: [C5, C1] };
  const clips = new Map<string, BundledClip>([[C5, { clip: bundle("c5.mp4", 10), thumbnail: bundle("c5.jpg", 1) }]]);
  assert.deepEqual(copyChoice(merge, { recordings: new Map([[R2, { path: "/b/v.mp4", bundle: bundle("v.mp4", 100) }]]), clips }),
    { videoBytes: 100, totalBytes: 111 });
  assert.equal(copyChoice(merge, { recordings: new Map([[R2, { path: "/local/v.mp4", bundle: null }]]), clips }), null);
  assert.equal(copyChoice({ ...merge, newRecordings: [] }, { recordings: new Map(), clips }), null);
});

test("merge copies are paired with their clips by uid, skipping clips the bundle has no file for", () => {
  const merge: MergePlan = { ops: [], kept: [], heldBack: [], newRecordings: [R2], clipFiles: [C1, C5, C2] };
  const recordings = new Map<string, ImportRecording>([[R2, { path: "/b/videos/v.mp4", bundle: bundle("videos/v.mp4", 100) }]]);
  const clips = new Map<string, BundledClip>([
    [C5, { clip: bundle("clips/c5.mp4", 10), thumbnail: null }],
    [C2, { clip: bundle("clips/c2.mp4", 20), thumbnail: bundle("clips/c2.jpg", 2) }],
  ]);
  let n = 0;
  const planned = planMergeCopies(merge, { recordings, clips }, {
    copyVideos: true, videosDir: "/u/videos", clipsDir: "/u/clips", exists: () => false, newName: () => `n${n++}`,
  });
  assert.deepEqual([...planned.files.recordingPaths], [[R2, "/u/videos/v.mp4"]]);
  assert.deepEqual([...planned.files.clipFiles], [
    [C5, { output: "/u/clips/n0.mp4", thumbnail: "" }],
    [C2, { output: "/u/clips/n1.mp4", thumbnail: "/u/clips/n1-thumb.jpg" }],
  ]);
  assert.equal(planned.totalBytes, 132);
  assert.throws(() => planMergeCopies({ ...merge, newRecordings: [R1] }, { recordings, clips }, {
    copyVideos: true, videosDir: "/u/videos", clipsDir: "/u/clips", exists: () => false, newName: () => "x",
  }), /ERROR_INVALID_INPUT/);
});

test("sessions match by uid and field, in any row order", () => {
  const base = baseSession();
  assert.ok(sessionsMatch(base, edit(base, s => s.clips.reverse())));
  assert.ok(!sessionsMatch(base, edit(base, s => { clipOf(s, C1).title = "x"; })));
  assert.ok(!sessionsMatch(base, edit(base, s => { s.drawings = []; })));
  assert.ok(!sessionsMatch(edit(base, s => { s.drawings = []; }), base));
  assert.ok(!sessionsMatch(base, edit(base, s => { s.drawings[0].uid = uid(99); })));
  assert.ok(sessionsMatch(base, edit(base, s => { s.project.name = "Renamed"; })), "the project row is not reviewed");
  assert.equal(D1.length, 36);
});
