// Which category a court-map dot belongs to, and what follows from it: the
// legend counts, the same-category list in the detail column, prev/next and
// the meta line. The screen, the exported PNG and the legend all go through
// dotCategoryId, so they agree on a dot's colour.
//
// No local imports: tsc rejects a ".ts" import path in this repo and Node's
// test runner cannot resolve one without it, so callers pass the time
// formatter (formatDuration from format.ts).

export interface CourtMapClip {
  id: number;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  categories: string; // JSON array of ids
  players?: string; // JSON array of ids
  quarter?: string | null;
  video_path?: string;
}
export interface CourtMapCategory { id: number; name: string; color: string }
export interface CourtMapPlayer { id: number; number?: string | null }
export type CategoryFilter = number | "all";

const parseIds = (json: string | undefined): number[] => {
  try {
    const ids = JSON.parse(json || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

export const parseCategoryIds = (clip: { categories: string }): number[] => parseIds(clip.categories);
export const parsePlayerIds = (clip: { players?: string }): number[] => parseIds(clip.players);

/** The category a dot is drawn in: the filtered category when the Category
 *  filter is set and the clip has it, else the clip's first category id that
 *  exists in knownIds, else null. Ids of deleted categories never count, so a
 *  clip whose only ids are unknown is uncategorised (null). */
export const dotCategoryId = (
  clip: CourtMapClip,
  filter: CategoryFilter,
  knownIds: ReadonlySet<number>,
): number | null => {
  const ids = parseCategoryIds(clip);
  if (filter !== "all" && ids.includes(filter) && knownIds.has(filter)) return filter;
  return ids.find(id => knownIds.has(id)) ?? null;
};

/** Legend rows for the dots drawn. Filter "all": every category in the given
 *  order, zeros kept. A category filter: only that category. A final row with
 *  id null counts uncategorised dots, present only when its count is > 0.
 *  Invariant: the counts sum to drawn.length. */
export const legendRows = (
  drawn: CourtMapClip[],
  categories: CourtMapCategory[],
  filter: CategoryFilter,
): { id: number | null; count: number }[] => {
  const knownIds = new Set(categories.map(c => c.id));
  const counts = new Map<number | null, number>();
  drawn.forEach(c => {
    const id = dotCategoryId(c, filter, knownIds);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  const rows: { id: number | null; count: number }[] = categories
    .filter(c => filter === "all" || c.id === filter)
    .map(c => ({ id: c.id, count: counts.get(c.id) ?? 0 }));
  const uncategorised = counts.get(null) ?? 0;
  if (uncategorised > 0) rows.push({ id: null, count: uncategorised });
  return rows;
};

/** Clips drawn on the court that share the selected clip's dot category, in
 *  game order: by gameOrder(clip), then start_time, then id. Includes the
 *  selected clip. Empty if selectedId is not among drawn. Uncategorised clips
 *  group together. */
export const sameCategoryClips = <T extends CourtMapClip>(
  drawn: T[],
  selectedId: number,
  filter: CategoryFilter,
  knownIds: ReadonlySet<number>,
  gameOrder: (clip: T) => number = () => 0,
): T[] => {
  const selected = drawn.find(c => c.id === selectedId);
  if (!selected) return [];
  const cat = dotCategoryId(selected, filter, knownIds);
  return drawn
    .filter(c => dotCategoryId(c, filter, knownIds) === cat)
    .map(c => ({ c, game: gameOrder(c) }))
    .sort((a, b) => a.game - b.game || a.c.start_time - b.c.start_time || a.c.id - b.c.id)
    .map(({ c }) => c);
};

/** The id one step before (-1) or after (+1) currentId in list, or null at an end. */
export const stepClip = (list: CourtMapClip[], currentId: number, step: -1 | 1): number | null => {
  const index = list.findIndex(c => c.id === currentId);
  if (index < 0) return null;
  return list[index + step]?.id ?? null;
};

/** ["#7, #11", "Q3", "1:14:03–1:14:11"] with missing parts left out. The
 *  range uses formatTime for each end and an en dash between them. */
export const clipMetaParts = (
  clip: CourtMapClip,
  players: CourtMapPlayer[],
  formatTime: (seconds: number) => string,
): string[] => {
  const numbers = parsePlayerIds(clip)
    .map(id => players.find(p => p.id === id)?.number)
    .filter((n): n is string => !!n)
    .map(n => `#${n}`);
  const parts: string[] = [];
  if (numbers.length > 0) parts.push(numbers.join(", "));
  if (clip.quarter) parts.push(clip.quarter);
  parts.push(`${formatTime(clip.start_time)}–${formatTime(clip.end_time)}`);
  return parts;
};
