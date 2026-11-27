// The review screen's contract between main and the renderer. Types only.

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

/** Ticked rows, and a side per conflicting field. */
export interface ReviewSelections {
  selected: Record<string, boolean>;
  choices: Record<string, Record<string, "mine" | "theirs">>;
}

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
