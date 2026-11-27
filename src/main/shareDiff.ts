import type { ParsedSession } from "./sessionData.ts";

export type ItemKind = "recording" | "category" | "player" | "clip" | "drawing";
export const ITEM_KINDS: readonly ItemKind[] = ["recording", "category", "player", "clip", "drawing"];

export type DiffGroup = "new" | "changed" | "conflict" | "deleted";

/** The field a conflict uses when one side has the item and the other deleted it. */
export const EXISTS = "exists";

export interface FieldChange {
  field: string;
  mine: unknown;
  theirs: unknown;
}

export interface DiffItem {
  /** `kind:uid`, what the renderer sends back for this row. */
  token: string;
  kind: ItemKind;
  uid: string;
  group: DiffGroup;
  /** Fields only they changed, taken when the row is ticked. */
  changes: FieldChange[];
  /** Fields both sides changed to different values; the coach picks one side per field. */
  conflicts: FieldChange[];
  /** Ticked by default: everything except a deletion they propose. */
  ticked: boolean;
}

export interface ShareDiff {
  hasBase: boolean;
  items: DiffItem[];
}

export type Fields = Record<string, unknown>;

const sorted = (uids: string[]): string[] => [...uids].sort();

/**
 * The fields compared per kind. Times and the court spot are one field each,
 * so a pick never mixes my start with their end. Links compare as uid sets.
 */
export const sessionRows = (session: ParsedSession, kind: ItemKind): Map<string, Fields> => {
  const rows = new Map<string, Fields>();
  const add = (uid: string | null, fields: Fields) => {
    if (!uid) throw new Error("INVALID_SESSION_FILE");
    rows.set(uid, fields);
  };
  switch (kind) {
    case "recording":
      for (const video of session.recordings) add(video.uid, {});
      break;
    case "category":
      for (const cat of session.categories) {
        add(cat.uid, { name: cat.name, color: cat.color.toLowerCase(), description: cat.description, parent: cat.parentKey });
      }
      break;
    case "player":
      for (const player of session.players) add(player.uid, { name: player.name, number: player.number || null });
      break;
    case "clip":
      for (const clip of session.clips) {
        add(clip.uid, {
          title: clip.title,
          notes: clip.notes,
          time: [clip.startTime, clip.endTime, clip.duration],
          categories: sorted(clip.categoryKeys),
          players: sorted(clip.playerKeys),
          quarter: clip.quarter || null,
          court: clip.courtX === null || clip.courtY === null ? null : [clip.courtX, clip.courtY],
          status: clip.status,
          recording: clip.recordingUid,
        });
      }
      break;
    case "drawing":
      for (const drawing of session.drawings) {
        add(drawing.uid, {
          timestamp: drawing.timestamp,
          data: drawing.data,
          displaySeconds: drawing.displaySeconds,
          pausePlayback: drawing.pausePlayback,
          recording: drawing.recordingUid,
        });
      }
      break;
  }
  return rows;
};

export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const differing = (mine: Fields, theirs: Fields): FieldChange[] =>
  Object.keys(theirs)
    .filter(field => !same(mine[field], theirs[field]))
    .map(field => ({ field, mine: mine[field], theirs: theirs[field] }));

/** One row of the three-way compare, or null when there is nothing to show. */
const diffItem = (
  kind: ItemKind, uid: string, base: Fields | undefined, mine: Fields | undefined, theirs: Fields | undefined,
  hasBase: boolean,
): DiffItem | null => {
  const item = (group: DiffGroup, changes: FieldChange[], conflicts: FieldChange[]): DiffItem =>
    ({ token: `${kind}:${uid}`, kind, uid, group, changes, conflicts, ticked: group !== "deleted" });
  const existence = (mineHas: boolean) => [{ field: EXISTS, mine: mineHas, theirs: !mineHas }];

  if (!hasBase) {
    if (mine && theirs) {
      const fields = differing(mine, theirs);
      return fields.length ? item("conflict", [], fields) : null;
    }
    return item("conflict", [], existence(mine !== undefined));
  }

  if (!theirs) {
    if (!base || !mine) return null;
    // They deleted what I edited: keeping mine stays the default, as for any deletion.
    return same(base, mine) ? item("deleted", [], []) : { ...item("conflict", [], existence(true)), ticked: false };
  }
  if (!mine) {
    if (!base) return item("new", [], []);
    return same(base, theirs) ? null : item("conflict", [], existence(false));
  }
  if (!base) {
    const fields = differing(mine, theirs);
    return fields.length ? item("conflict", [], fields) : null;
  }

  const changes: FieldChange[] = [];
  const conflicts: FieldChange[] = [];
  for (const field of Object.keys(theirs)) {
    if (same(base[field], theirs[field]) || same(mine[field], theirs[field])) continue;
    const change = { field, mine: mine[field], theirs: theirs[field] };
    if (same(base[field], mine[field])) changes.push(change);
    else conflicts.push(change);
  }
  if (conflicts.length) return item("conflict", changes, conflicts);
  return changes.length ? item("changed", changes, []) : null;
};

/**
 * Three-way compare by uid. With no base, every difference is a conflict and
 * the coach's own side is the default pick.
 */
export const diffSessions = (base: ParsedSession | null, mine: ParsedSession, theirs: ParsedSession): ShareDiff => {
  const items: DiffItem[] = [];
  for (const kind of ITEM_KINDS) {
    const baseRows = base ? sessionRows(base, kind) : new Map<string, Fields>();
    const mineRows = sessionRows(mine, kind);
    const theirRows = sessionRows(theirs, kind);
    const uids = new Set([...theirRows.keys(), ...mineRows.keys(), ...baseRows.keys()]);
    for (const uid of uids) {
      const row = diffItem(kind, uid, baseRows.get(uid), mineRows.get(uid), theirRows.get(uid), base !== null);
      if (row) items.push(row);
    }
  }
  return { hasBase: base !== null, items };
};
