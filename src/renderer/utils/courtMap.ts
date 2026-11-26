// Which category a court-map dot belongs to, and what follows from it: the
// legend counts, the same-category list in the detail column and prev/next.
// The screen, the exported PNG and the legend all go through dotCategoryId,
// so they agree on a dot's colour.
//
// No local imports: tsc rejects a ".ts" import path in this repo and Node's
// test runner cannot resolve one without it. Callers parse the clip's category
// ids with clipFilters.parseIds and pass them in as catIds.

export interface CourtMapClip {
  id: number;
  start_time: number;
  catIds: number[];
}
export interface CourtMapCategory { id: number; name: string; color: string }
/** The Category filter: "all", or a category id plus the ids that count as it
 *  (itself and, for a parent, its subcategories; see clipFilters.categoryFamily). */
export type CategoryFilter = "all" | { id: number; ids: ReadonlySet<number> };

/** The category a dot is drawn in: the filtered category when the Category
 *  filter is a known category and the clip is in it, else the clip's first
 *  category id that exists in knownIds, else null. Ids of deleted categories
 *  never count, so a clip whose only ids are unknown is uncategorised (null). */
export const dotCategoryId = (
  clip: CourtMapClip,
  filter: CategoryFilter,
  knownIds: ReadonlySet<number>,
): number | null => {
  if (filter !== "all" && knownIds.has(filter.id) && clip.catIds.some(id => filter.ids.has(id))) {
    return filter.id;
  }
  return clip.catIds.find(id => knownIds.has(id)) ?? null;
};

/** Legend rows for the dots drawn. Filter "all", or a filter id not among
 *  categories: every category in the given order, zeros kept. A known category
 *  filter: only that category. A final row with id null counts uncategorised
 *  dots, present only when its count is > 0. Invariant: the counts sum to
 *  drawn.length, given drawn is what the filter lets through. */
export const legendRows = (
  drawn: CourtMapClip[],
  categories: CourtMapCategory[],
  filter: CategoryFilter,
): { id: number | null; count: number }[] => {
  const knownIds = new Set(categories.map(c => c.id));
  const active = filter !== "all" && knownIds.has(filter.id) ? filter : "all";
  const counts = new Map<number | null, number>();
  drawn.forEach(c => {
    const id = dotCategoryId(c, active, knownIds);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  const rows: { id: number | null; count: number }[] = categories
    .filter(c => active === "all" || c.id === active.id)
    .map(c => ({ id: c.id, count: counts.get(c.id) ?? 0 }));
  const uncategorised = counts.get(null) ?? 0;
  if (uncategorised > 0) rows.push({ id: null, count: uncategorised });
  return rows;
};

/** Clips drawn on the court that share the selected clip's dot category, in
 *  game order: by gameOrder(clip), then start_time, then id. A negative
 *  gameOrder (game not found) sorts last. Includes the selected clip. Empty if
 *  selectedId is not among drawn. Uncategorised clips group together. */
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
    .map(c => {
      const game = gameOrder(c);
      return { c, game: game < 0 ? Number.MAX_SAFE_INTEGER : game };
    })
    .sort((a, b) => a.game - b.game || a.c.start_time - b.c.start_time || a.c.id - b.c.id)
    .map(({ c }) => c);
};

/** The id one step before (-1) or after (+1) currentId in list, or null at an end. */
export const stepClip = (list: { id: number }[], currentId: number, step: -1 | 1): number | null => {
  const index = list.findIndex(c => c.id === currentId);
  if (index < 0) return null;
  return list[index + step]?.id ?? null;
};
