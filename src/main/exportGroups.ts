export type ExportCategory = { id?: number; parent_id?: number | null };

/**
 * The selected folders a clip goes in. Each of its categories goes to its own
 * folder when that is selected, otherwise to its parent's.
 */
export const exportFoldersFor = (
  clipCategoryIds: number[],
  selectedIds: number[],
  categories: ExportCategory[],
): number[] => {
  const parentOf = new Map(categories.map(category => [category.id, category.parent_id ?? null]));
  const folders = new Set<number>();
  for (const id of clipCategoryIds) {
    if (selectedIds.includes(id)) folders.add(id);
    else {
      const parent = parentOf.get(id);
      if (parent != null && selectedIds.includes(parent)) folders.add(parent);
    }
  }
  return selectedIds.filter(id => folders.has(id));
};
