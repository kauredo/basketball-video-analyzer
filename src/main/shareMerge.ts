import { EXISTS, ITEM_KINDS, same, sessionRows, type DiffItem, type Fields, type ItemKind, type ShareDiff } from "./shareDiff.ts";
import { INVALID_INPUT, SHARE_ID_TAKEN } from "./shareBundle.ts";
import { planImportCopies, type ImportPlanInput, type MergeShare } from "./shareImport.ts";
import type { MergeFiles } from "./shareApply.ts";
import type { ParsedSession } from "./sessionData.ts";
import type { ShareSnapshot } from "./shareSnapshots.ts";
import type { HeldBack } from "../shared/shareReview.ts";

export type Choice = "mine" | "theirs";

export type ShareStanding =
  | { kind: "applied" }
  | { kind: "review"; base: ShareSnapshot | null; snapshot: { id: string; data: string } | null };

/**
 * What to do with a share of a project that is already here. Only a 'sent'
 * snapshot of this project, written when this computer shared it, can be the
 * base. A 'received' one with the file's own id means it was applied already.
 * Any other snapshot with that id is refused, so a file cannot plant its own base.
 */
export const classifyShare = (
  share: { snapshot: { id: string; data: string } | null; basedOn: string | null },
  projectId: number,
  getSnapshot: (id: string) => ShareSnapshot | null,
): ShareStanding => {
  const existing = share.snapshot ? getSnapshot(share.snapshot.id) : null;
  if (existing) {
    if (existing.project_id === projectId && existing.direction === "received") return { kind: "applied" };
    throw new Error(SHARE_ID_TAKEN);
  }
  const sent = share.basedOn ? getSnapshot(share.basedOn) : null;
  return {
    kind: "review",
    base: sent?.project_id === projectId && sent.direction === "sent" ? sent : null,
    snapshot: share.snapshot,
  };
};

export const rowsOf = (session: ParsedSession) =>
  new Map(ITEM_KINDS.map(kind => [kind, sessionRows(session, kind)] as const));

/**
 * What the bundle has to provide: every recording I lack that a row of theirs
 * could bring, and a cut file for clips that are new, restored or moved.
 */
export const mergeNeeds = (
  diff: ShareDiff, mine: ParsedSession, theirs: ParsedSession,
): { recordings: string[]; clips: string[] } => {
  const mineRecordings = new Set(mine.recordings.map(video => video.uid));
  const theirRows = rowsOf(theirs);
  const recordings = new Set<string>();
  for (const item of diff.items) {
    if (item.kind === "recording") recordings.add(item.uid);
    const row = theirRows.get(item.kind)!.get(item.uid);
    if ((item.kind === "clip" || item.kind === "drawing") && row) recordings.add(row.recording as string);
  }
  const clips = diff.items.filter(item => item.kind === "clip" && (
    item.group === "new" ||
    [...item.changes, ...item.conflicts].some(change =>
      change.field === "time" || change.field === "recording" || (change.field === EXISTS && change.theirs === true))));
  return {
    recordings: theirs.recordings
      .map(video => video.uid as string)
      .filter(uid => recordings.has(uid) && !mineRecordings.has(uid)),
    clips: clips.map(item => item.uid),
  };
};

export interface MergeSelections {
  selected: Set<string>;
  choices: Map<string, Map<string, Choice>>;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The coach's picks as the renderer sent them: `selected` maps a row's token
 * to a boolean, `choices` maps it to { field: "mine" | "theirs" } for its
 * conflicting fields. Anything that is not a row or field of this diff is refused.
 */
export const validateSelections = (diff: ShareDiff, input: unknown): MergeSelections => {
  const refuse = () => new Error(INVALID_INPUT);
  if (!record(input) || !record(input.selected) || !record(input.choices)) throw refuse();
  const items = new Map(diff.items.map(item => [item.token, item]));
  const selected = new Set<string>();
  for (const [token, value] of Object.entries(input.selected)) {
    if (!items.has(token) || typeof value !== "boolean") throw refuse();
    if (value) selected.add(token);
  }
  const choices = new Map<string, Map<string, Choice>>();
  for (const [token, fields] of Object.entries(input.choices)) {
    const item = items.get(token);
    if (!item || !record(fields)) throw refuse();
    const picks = new Map<string, Choice>();
    for (const [field, choice] of Object.entries(fields)) {
      if (!item.conflicts.some(conflict => conflict.field === field) || (choice !== "mine" && choice !== "theirs")) {
        throw refuse();
      }
      picks.set(field, choice);
    }
    choices.set(token, picks);
  }
  return { selected, choices };
};

/** True when two sessions hold the same rows, by uid, field for field; row order does not matter. */
export const sessionsMatch = (a: ParsedSession, b: ParsedSession): boolean =>
  ITEM_KINDS.every(kind => {
    const left = sessionRows(a, kind);
    const right = sessionRows(b, kind);
    return left.size === right.size && [...left].every(([uid, fields]) => right.has(uid) && same(fields, right.get(uid)));
  });

export type MergeOp =
  | { op: "insert"; kind: ItemKind; uid: string; row: Fields }
  | { op: "update"; kind: ItemKind; uid: string; fields: Fields }
  | { op: "delete"; kind: ItemKind; uid: string };

export interface MergePlan {
  ops: MergeOp[];
  /** Tokens of ticked deletions left in place because something still uses them. */
  kept: string[];
  /** Ticked changes left as they are here, because they would loop, nest too deep or clash on a name. */
  heldBack: HeldBack[];
  /** Recordings inserted, in op order; each needs a video path. */
  newRecordings: string[];
  /** Clips that end up with their time and recording, inserted or moved: each takes their cut file. */
  clipFiles: string[];
}

type Rows = Map<ItemKind, Map<string, Fields>>;

const refs = (value: unknown): string[] =>
  Array.isArray(value) ? value as string[] : typeof value === "string" ? [value] : [];

/** How many rows point at each row, by token: clips at tags, players and recordings, drawings at recordings, subcategories at parents. */
export const countUsers = (rows: Rows): Map<string, number> => {
  const counts = new Map<string, number>();
  const add = (kind: ItemKind, uids: string[]) => {
    for (const uid of uids) counts.set(`${kind}:${uid}`, (counts.get(`${kind}:${uid}`) ?? 0) + 1);
  };
  for (const clip of rows.get("clip")!.values()) {
    add("category", refs(clip.categories));
    add("player", refs(clip.players));
    add("recording", refs(clip.recording));
  }
  for (const drawing of rows.get("drawing")!.values()) add("recording", refs(drawing.recording));
  for (const cat of rows.get("category")!.values()) add("category", refs(cat.parent));
  return counts;
};

export const usersOf = (counts: Map<string, number>, kind: ItemKind, uid: string): number =>
  counts.get(`${kind}:${uid}`) ?? 0;

const PHASES: Array<[MergeOp["op"], ItemKind]> = [
  ["insert", "recording"], ["insert", "category"], ["insert", "player"],
  ["update", "category"], ["update", "player"],
  ["insert", "clip"], ["update", "clip"], ["insert", "drawing"], ["update", "drawing"],
  ["delete", "clip"], ["delete", "drawing"], ["delete", "category"], ["delete", "player"], ["delete", "recording"],
];

/** Turns the ticked rows into row operations, keyed by uid. Nothing unticked is touched. */
export const planMerge = (
  diff: ShareDiff, mine: ParsedSession, theirs: ParsedSession, selections: MergeSelections,
): MergePlan => {
  const mineRows = rowsOf(mine);
  const theirRows = rowsOf(theirs);
  const ops: MergeOp[] = [];

  const pickedOp = (item: DiffItem): MergeOp | null => {
    const { kind, uid } = item;
    const theirsRow = () => theirRows.get(kind)!.get(uid)!;
    if (item.group === "new") return { op: "insert", kind, uid, row: theirsRow() };
    if (item.group === "deleted") return { op: "delete", kind, uid };
    const picks = selections.choices.get(item.token);
    const theirsWins = (field: string) => picks?.get(field) === "theirs";
    if (item.conflicts[0]?.field === EXISTS) {
      if (!theirsWins(EXISTS)) return null;
      return item.conflicts[0].theirs === true ? { op: "insert", kind, uid, row: theirsRow() } : { op: "delete", kind, uid };
    }
    const fields: Fields = {};
    for (const change of item.changes) fields[change.field] = change.theirs;
    for (const conflict of item.conflicts) if (theirsWins(conflict.field)) fields[conflict.field] = conflict.theirs;
    return Object.keys(fields).length ? { op: "update", kind, uid, fields } : null;
  };
  for (const item of diff.items) {
    if (!selections.selected.has(item.token)) continue;
    const op = pickedOp(item);
    if (op) ops.push(op);
  }

  // The rows after the merge, per kind, to check what still points where.
  const after = (kind: ItemKind): Map<string, Fields> => {
    const result = new Map(mineRows.get(kind)!);
    for (const op of ops) {
      if (op.kind !== kind) continue;
      if (op.op === "insert") result.set(op.uid, op.row);
      else if (op.op === "update") result.set(op.uid, { ...result.get(op.uid), ...op.fields });
      else result.delete(op.uid);
    }
    return result;
  };
  const deleting = (kind: ItemKind, uid: string) =>
    ops.some(op => op.op === "delete" && op.kind === kind && op.uid === uid);

  // A ticked row brings the rows of theirs it points at and this project lacks:
  // tags and players, the recording it sits on, a subcategory's parent.
  const bring = (kind: ItemKind, field: string, target: ItemKind) => {
    for (;;) {
      const present = after(target);
      const missing = [...after(kind).values()].flatMap(row => refs(row[field]))
        .find(uid => !present.has(uid) && !deleting(target, uid) && theirRows.get(target)!.has(uid));
      if (!missing) return;
      ops.push({ op: "insert", kind: target, uid: missing, row: theirRows.get(target)!.get(missing)! });
    }
  };
  bring("clip", "categories", "category");
  bring("clip", "players", "player");
  bring("clip", "recording", "recording");
  bring("drawing", "recording", "recording");
  bring("category", "parent", "category");

  const heldBack: HeldBack[] = [];
  const holdBack = (op: Extract<MergeOp, { op: "update" }>, fields: string[], entry: HeldBack) => {
    for (const field of fields) delete op.fields[field];
    if (Object.keys(op.fields).length === 0) ops.splice(ops.indexOf(op), 1);
    heldBack.push(entry);
  };
  const nameOf = (kind: ItemKind, uid: string) =>
    String((mineRows.get(kind)!.get(uid) ?? theirRows.get(kind)!.get(uid))?.name ?? "");

  // A parent change that would put a category inside itself stays as it is here.
  for (;;) {
    const categories = after("category");
    const loopFrom = (uid: string): string[] | null => {
      const chain: string[] = [];
      for (let at: string | null = uid; at; at = (categories.get(at)?.parent as string | null) ?? null) {
        const seen = chain.indexOf(at);
        if (seen >= 0) return chain.slice(seen);
        chain.push(at);
      }
      return null;
    };
    const loop = [...categories.keys()].map(loopFrom).find(members => members !== null);
    const op = loop && ops.find((candidate): candidate is Extract<MergeOp, { op: "update" }> =>
      candidate.op === "update" && candidate.kind === "category" && "parent" in candidate.fields &&
      loop.includes(candidate.uid));
    if (!op) break;
    holdBack(op, ["parent"], { name: nameOf("category", op.uid), reason: "loop" });
  }

  // The app nests categories one level deep: a parent change that would make
  // a grandchild, or give a child children of its own, stays as it is here.
  for (;;) {
    const categories = after("category");
    const parentOf = (uid: string) => (categories.get(uid)?.parent as string | null | undefined) ?? null;
    const deep = [...categories.keys()].find(uid => {
      const parent = parentOf(uid);
      return parent !== null && parentOf(parent) !== null;
    });
    const chain = deep ? [deep, parentOf(deep)!] : [];
    const op = ops.find((candidate): candidate is Extract<MergeOp, { op: "update" }> =>
      candidate.op === "update" && candidate.kind === "category" && "parent" in candidate.fields &&
      chain.includes(candidate.uid));
    if (!op) break;
    holdBack(op, ["parent"], { name: nameOf("category", op.uid), reason: "depth" });
  }

  // A rename or move onto a name another row has, or still has while the
  // apply runs (a swap), stays as it is here, so no unique name index fails.
  for (const kind of ["category", "player"] as const) {
    const key = (row: Fields | undefined) =>
      kind === "category" ? `${row?.parent ?? ""}\u0000${row?.name}` : String(row?.name);
    for (;;) {
      const rows = after(kind);
      const clash = ops.find((op): op is Extract<MergeOp, { op: "update" }> => {
        if (op.op !== "update" || op.kind !== kind || !("name" in op.fields || "parent" in op.fields)) return false;
        const target = key(rows.get(op.uid));
        return [...rows].some(([uid, row]) =>
          uid !== op.uid && (key(row) === target || key(mineRows.get(kind)!.get(uid)) === target));
      });
      if (!clash) break;
      const to = String(rows.get(clash.uid)?.name);
      holdBack(clash, "name" in clash.fields ? ["name"] : ["parent"], { name: nameOf(kind, clash.uid), to, reason: "name" });
    }
  }

  // A ticked deletion of something still in use stays, and so does the first
  // recording (the project's own video). Counts are taken once; a kept
  // subcategory counts again for its parent, so children go first.
  const final: Rows = new Map(ITEM_KINDS.map(kind => [kind, after(kind)]));
  const counts = countUsers(final);
  const depth = (uid: string): number => {
    let levels = 0;
    for (let at = mineRows.get("category")!.get(uid)?.parent as string | null; at && levels < 10; levels++) {
      at = mineRows.get("category")!.get(at)?.parent as string | null;
    }
    return levels;
  };
  const kept: string[] = [];
  const deletions = ops.filter(op => op.op === "delete")
    .sort((a, b) => (b.kind === "category" ? depth(b.uid) : 0) - (a.kind === "category" ? depth(a.uid) : 0));
  for (const op of deletions) {
    const firstRecording = op.kind === "recording" && op.uid === mine.recordings[0]?.uid;
    if (!firstRecording && usersOf(counts, op.kind, op.uid) === 0) continue;
    ops.splice(ops.indexOf(op), 1);
    kept.push(`${op.kind}:${op.uid}`);
    const parent = op.kind === "category" ? mineRows.get("category")!.get(op.uid)?.parent as string | null : null;
    if (parent) counts.set(`category:${parent}`, usersOf(counts, "category", parent) + 1);
  }

  const phase = (op: MergeOp) => PHASES.findIndex(([kind, table]) => kind === op.op && table === op.kind);
  // Parents are inserted before their children and deleted after them.
  const order = (op: MergeOp) => {
    if (op.kind !== "category") return 0;
    const row = op.op === "insert" ? op.row : mineRows.get("category")!.get(op.uid);
    const child = row?.parent ? 1 : 0;
    return op.op === "delete" ? -child : child;
  };
  ops.sort((a, b) => phase(a) - phase(b) || order(a) - order(b));

  // Their cut file fits only when the clip ends up with both their time and their recording.
  const clipsAfter = after("clip");
  const takesTheirFile = (uid: string) => {
    const row = clipsAfter.get(uid);
    const theirsRow = theirRows.get("clip")!.get(uid);
    return !!row && !!theirsRow && same(row.time, theirsRow.time) && same(row.recording, theirsRow.recording);
  };
  return {
    ops,
    kept,
    heldBack,
    newRecordings: ops.filter(op => op.op === "insert" && op.kind === "recording").map(op => op.uid),
    clipFiles: ops
      .filter(op => op.kind === "clip" && (op.op === "insert" || (op.op === "update" &&
        ("time" in op.fields || "recording" in op.fields))))
      .map(op => op.uid)
      .filter(takesTheirFile),
  };
};

/**
 * The copy-or-use-in-place question, asked only when a ticked new recording
 * comes in the bundle: its bytes, and everything the merge would copy.
 */
export const copyChoice = (
  plan: MergePlan, pending: Pick<MergeShare, "recordings" | "clips">,
): { videoBytes: number; totalBytes: number } | null => {
  const bundled = plan.newRecordings.map(uid => pending.recordings.get(uid)?.bundle).filter(file => file);
  if (bundled.length === 0) return null;
  const videoBytes = bundled.reduce((total, file) => total + file!.size, 0);
  const clipBytes = plan.clipFiles.reduce((total, uid) => {
    const clip = pending.clips.get(uid);
    return total + (clip ? clip.clip.size + (clip.thumbnail?.size ?? 0) : 0);
  }, 0);
  return { videoBytes, totalBytes: videoBytes + clipBytes };
};

/** What a merge copies, and where each new recording and clip file ends up, by uid. */
export const planMergeCopies = (
  plan: MergePlan,
  pending: Pick<MergeShare, "recordings" | "clips">,
  options: Omit<ImportPlanInput, "recordings" | "clips">,
): { copies: ReturnType<typeof planImportCopies>["copies"]; totalBytes: number; files: MergeFiles } => {
  const recordings = plan.newRecordings.map(uid => {
    const recording = pending.recordings.get(uid);
    if (!recording) throw new Error(INVALID_INPUT);
    return { uid, recording };
  });
  const clips = plan.clipFiles.flatMap(uid => {
    const clip = pending.clips.get(uid);
    return clip ? [{ uid, clip }] : [];
  });
  const planned = planImportCopies({
    ...options, recordings: recordings.map(entry => entry.recording), clips: clips.map(entry => entry.clip),
  });
  return {
    copies: planned.copies,
    totalBytes: planned.totalBytes,
    files: {
      recordingPaths: new Map(recordings.map((entry, index) => [entry.uid, planned.paths[index]])),
      clipFiles: new Map(clips.map((entry, index) => [entry.uid, planned.clipFiles[index]!])),
    },
  };
};
