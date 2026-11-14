// Column names are interpolated into SQL, so they must come from this list,
// never from arbitrary caller keys.
const UPDATABLE_CATEGORY_COLUMNS = ["name", "color", "description", "parent_id"] as const;

export const categoryUpdateFields = (updates: object): string[] =>
  UPDATABLE_CATEGORY_COLUMNS.filter((column) => column in updates);
