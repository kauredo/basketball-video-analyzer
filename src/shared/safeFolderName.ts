/** A category name made safe to use as one folder name on every platform. */
export const safeFolderName = (name: string): string => {
  const safe = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return safe === "" || safe === "." || safe === ".." ? "Category" : safe;
};
