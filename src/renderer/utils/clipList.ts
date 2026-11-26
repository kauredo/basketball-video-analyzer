// The bottom clip list's width and column rules, kept free of React and of
// other modules so `npm test` can run it with type stripping.

export const LIST_WIDTHS = ["narrow", "wide", "full"] as const;
export type ListWidth = (typeof LIST_WIDTHS)[number];

/** A stored value from an older build or a hand edit falls back to narrow. */
export const parseListWidth = (saved: unknown): ListWidth =>
  (LIST_WIDTHS as readonly unknown[]).includes(saved) ? (saved as ListWidth) : "narrow";

export type ListColumn = "number" | "time" | "category" | "title" | "notes" | "duration" | "status";

/** The one column list the header and every row render from. */
export const listColumns = (opts: {
  width: ListWidth;
  singleCategory: boolean;
  anyStatus: boolean;
}): ListColumn[] => {
  const cols: ListColumn[] = ["number", "time"];
  if (!opts.singleCategory) cols.push("category");
  cols.push("title");
  if (opts.width !== "narrow") cols.push("notes");
  cols.push("duration");
  if (opts.anyStatus) cols.push("status");
  return cols;
};

/** 1-based position of each clip by start time, ties broken by id. */
export const clipNumbers = (clips: { id: number; start_time: number }[]): Map<number, number> => {
  const sorted = [...clips].sort((a, b) => a.start_time - b.start_time || a.id - b.id);
  return new Map(sorted.map((clip, i) => [clip.id, i + 1]));
};
