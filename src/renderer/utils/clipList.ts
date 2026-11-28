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

type Timed = { id: number; start_time: number };

/** List order: start time, ties broken by id. */
export const compareByStart = (a: Timed, b: Timed): number =>
  a.start_time - b.start_time || a.id - b.id;

/** 1-based position of each clip in list order. */
export const clipNumbers = (clips: Timed[]): Map<number, number> => {
  const sorted = [...clips].sort(compareByStart);
  return new Map(sorted.map((clip, i) => [clip.id, i + 1]));
};

export type SortField = "date" | "duration" | "title";
export type SortOrder = "asc" | "desc";

/** Newest and longest first, but titles A to Z. */
export const firstSortOrder = (field: SortField): SortOrder => (field === "title" ? "asc" : "desc");

type Sortable = { title: string; created_at?: string | null; start_time: number; end_time: number };

/** "desc" is newest, longest, or Z to A; "asc" the reverse. */
export const sortClips = <T extends Sortable>(clips: T[], by: SortField, order: SortOrder): T[] =>
  [...clips].sort((a, b) => {
    let comparison = 0;
    switch (by) {
      case "date":
        comparison = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        break;
      case "duration":
        comparison = b.end_time - b.start_time - (a.end_time - a.start_time);
        break;
      case "title":
        comparison = b.title.localeCompare(a.title);
        break;
    }
    return order === "asc" ? -comparison : comparison;
  });
