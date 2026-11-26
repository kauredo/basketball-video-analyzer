import type { ClipStatus } from "../../types/global";

// The clip library's filter derivation, kept free of React so it can be tested.

export interface FilterableClip {
  title: string;
  notes?: string;
  categories: string;
  players?: string;
  status?: ClipStatus | null;
  duration: number;
}

export interface CategoryNode {
  id: number;
  name: string;
  color: string;
  children?: CategoryNode[];
}

export interface ClipFilters {
  search: string;
  categoryId: number | null;
  playerId: number | null;
  status: ClipStatus | null;
}

export const NO_FILTERS: ClipFilters = {
  search: "",
  categoryId: null,
  playerId: null,
  status: null,
};

/** A clip's JSON id array; [] for anything malformed, non-number elements dropped. */
export function parseIds(json?: string | null): number[] {
  try {
    const ids: unknown = JSON.parse(json || "[]");
    return Array.isArray(ids)
      ? ids.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [];
  } catch {
    return [];
  }
}

/**
 * A parent category owns its subcategories' clips too: quick tag and most
 * manual tagging pick the subcategory, so an exact-id match left "Offense (0)".
 * Parents map to themselves plus their children; children to themselves.
 */
export function categoryFamily(categories: CategoryNode[]): Map<number, Set<number>> {
  const family = new Map<number, Set<number>>();
  categories.forEach(parent => {
    family.set(parent.id, new Set([parent.id, ...(parent.children ?? []).map(child => child.id)]));
    parent.children?.forEach(child => family.set(child.id, new Set([child.id])));
  });
  return family;
}

/** Looks through parents and their children; the top level holds parents only. */
export function findCategory(categories: CategoryNode[], id: number): CategoryNode | undefined {
  for (const parent of categories) {
    if (parent.id === id) return parent;
    const child = parent.children?.find(c => c.id === id);
    if (child) return child;
  }
  return undefined;
}

/**
 * Drops a category or player filter whose id is no longer in the project, so a
 * deletion cannot leave an active filter with no chip and an empty list.
 * Returns the same object when nothing changed.
 */
export function pruneStaleFilters(
  filters: ClipFilters,
  categories: CategoryNode[],
  players: { id: number }[],
): ClipFilters {
  const staleCategory =
    filters.categoryId !== null && !findCategory(categories, filters.categoryId);
  const stalePlayer =
    filters.playerId !== null && !players.some(p => p.id === filters.playerId);
  if (!staleCategory && !stalePlayer) return filters;
  return {
    ...filters,
    categoryId: staleCategory ? null : filters.categoryId,
    playerId: stalePlayer ? null : filters.playerId,
  };
}

export function clipInCategory(
  clip: FilterableClip,
  categoryId: number,
  family: Map<number, Set<number>>,
): boolean {
  const ids = family.get(categoryId) ?? new Set([categoryId]);
  return parseIds(clip.categories).some(id => ids.has(id));
}

export function filterClips<T extends FilterableClip>(
  clips: T[],
  filters: ClipFilters,
  family: Map<number, Set<number>>,
): T[] {
  const term = filters.search.toLowerCase();
  return clips.filter(clip => {
    const matchesSearch =
      clip.title.toLowerCase().includes(term) ||
      (clip.notes?.toLowerCase().includes(term) ?? false);
    const matchesCategory =
      filters.categoryId === null || clipInCategory(clip, filters.categoryId, family);
    const matchesPlayer =
      filters.playerId === null || parseIds(clip.players).includes(filters.playerId);
    const matchesStatus = filters.status === null || clip.status === filters.status;
    return matchesSearch && matchesCategory && matchesPlayer && matchesStatus;
  });
}

/** Parent ids count their whole family once per clip; child ids count exact tags. */
export function categoryCounts(
  clips: FilterableClip[],
  categories: CategoryNode[],
): Map<number, number> {
  const family = categoryFamily(categories);
  const counts = new Map<number, number>();
  family.forEach((_, id) => {
    counts.set(id, clips.filter(clip => clipInCategory(clip, id, family)).length);
  });
  return counts;
}

export function playerCounts(clips: FilterableClip[]): Map<number, number> {
  const counts = new Map<number, number>();
  clips.forEach(clip => {
    new Set(parseIds(clip.players)).forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  return counts;
}

/** Category, player and status; search is not counted. */
export function activeFilterCount(filters: ClipFilters): number {
  return (
    (filters.categoryId !== null ? 1 : 0) +
    (filters.playerId !== null ? 1 : 0) +
    (filters.status !== null ? 1 : 0)
  );
}

export function summarize(
  shown: FilterableClip[],
  total: number,
): { shown: number; total: number; seconds: number } {
  return {
    shown: shown.length,
    total,
    seconds: shown.reduce(
      (sum, clip) => sum + (Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : 0),
      0,
    ),
  };
}
