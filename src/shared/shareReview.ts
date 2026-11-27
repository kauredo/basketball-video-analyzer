// The review screen's contract between main and the renderer, and the
// screen's selection rules. Imports nothing, so `npm test` can run it.

export type ReviewKind = "recording" | "category" | "player" | "clip" | "drawing";
export type ReviewGroup = "new" | "changed" | "conflict" | "deleted";

/** A value as the review screen shows it. */
export type ReviewValue =
  | { type: "text"; text: string }
  | { type: "time"; start: number; end: number }
  | { type: "seconds"; seconds: number | null }
  | { type: "tags"; tags: Array<{ name: string; color: string | null }> }
  | { type: "color"; color: string }
  | { type: "flag"; on: boolean }
  | { type: "status"; status: "keep" | "cut" | "review" | null }
  | { type: "court"; set: boolean }
  | { type: "shapes"; count: number }
  | { type: "exists"; exists: boolean };

export interface ReviewField {
  field: string;
  mine: ReviewValue;
  theirs: ReviewValue;
}

export interface ReviewRow {
  /** `kind:uid`, what the renderer sends back for this row. */
  token: string;
  kind: ReviewKind;
  group: ReviewGroup;
  ticked: boolean;
  preview: {
    title: string;
    start?: number;
    end?: number;
    tags?: Array<{ name: string; color: string | null }>;
    color?: string;
    detail?: string;
  };
  changes: ReviewField[];
  conflicts: ReviewField[];
  /** For a deletion: how many rows here still use it, so it would stay. */
  inUse: number;
  /** Applying their time or video leaves this clip without a cut file until it is cut again. */
  recut: boolean;
}

export interface ShareReview {
  hasBase: boolean;
  rows: ReviewRow[];
}

export type ReviewSide = "mine" | "theirs";

/** Ticked rows, and a side per conflicting field. */
export interface ReviewSelections {
  selected: Record<string, boolean>;
  choices: Record<string, Record<string, ReviewSide>>;
}

/**
 * A conflict row with only conflicting fields has no checkbox: it is always
 * sent and its picks decide. One that also carries changes only they made
 * keeps a checkbox, so those changes can be declined.
 */
export const hasRowCheckbox = (row: ReviewRow): boolean => row.group !== "conflict" || row.changes.length > 0;

export const initialSelected = (rows: ReviewRow[]): Record<string, boolean> =>
  Object.fromEntries(rows.map(row => [row.token, row.group === "conflict" || row.ticked]));

export const initialChoices = (rows: ReviewRow[]): ReviewSelections["choices"] =>
  Object.fromEntries(rows.filter(row => row.conflicts.length > 0).map(row =>
    [row.token, Object.fromEntries(row.conflicts.map(conflict => [conflict.field, "mine" as const]))]));

/** Every conflicting field of `rows` to one side; a row with its own changes is ticked for theirs, unticked for mine. */
export const pickAll = (
  choices: ReviewSelections["choices"], selected: ReviewSelections["selected"], rows: ReviewRow[], side: ReviewSide,
): ReviewSelections => ({
  choices: {
    ...choices,
    ...Object.fromEntries(rows.map(row => [row.token, Object.fromEntries(row.conflicts.map(item => [item.field, side]))])),
  },
  selected: {
    ...selected,
    ...Object.fromEntries(rows.filter(row => row.changes.length > 0).map(row => [row.token, side === "theirs"])),
  },
});

/** The rows an apply would change: ticked, and for a conflict row, with its own changes or a field on Theirs. */
export const appliedCount = (
  rows: ReviewRow[], selected: ReviewSelections["selected"], choices: ReviewSelections["choices"],
): number => rows.filter(row => selected[row.token] === true && (row.group !== "conflict" ||
  row.changes.length > 0 || row.conflicts.some(item => choices[row.token]?.[item.field] === "theirs"))).length;

/** A change from their file that was left as it is here, and why. */
export interface HeldBack {
  name: string;
  /** The name it would have taken, for a name clash. */
  to?: string;
  reason: "loop" | "depth" | "name";
}

export type OpenSharedResult =
  | { status: "review"; name: string; review: ShareReview }
  | { status: "applied"; name: string }
  | { status: "choose"; videoBytes: number; canCopy: boolean }
  | { status: "imported"; project: any }
  | { status: "merged"; project: any; kept: number; heldBack: HeldBack[] };
