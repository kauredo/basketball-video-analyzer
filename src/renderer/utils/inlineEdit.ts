export type EditField = "title" | "notes";

/** The text a field starts from when editing opens. */
export const draftFor = (
  field: EditField,
  clip: { title: string; notes?: string | null },
): string => (field === "title" ? clip.title : clip.notes || "");

/**
 * What a committed draft writes, or null when nothing should be written.
 * The draft is trimmed. An empty title reverts, because a clip without a
 * title cannot be told apart in export filenames; an empty note is a real
 * value. A value equal to the current one is skipped. Line breaks in a title
 * (pasted text) become single spaces.
 */
export const editedValue = (
  field: EditField,
  draft: string,
  current: string | null | undefined,
): string | null => {
  let value = draft.trim();
  if (field === "title") value = value.replace(/\s*[\r\n]+\s*/g, " ");
  if (field === "title" && value === "") return null;
  if (value === (current ?? "")) return null;
  return value;
};

/** What a key does in an open editor. Shift+Enter is a newline in notes. */
export const editKeyAction = (
  field: EditField,
  key: string,
  shiftKey: boolean,
): "commit" | "cancel" | null => {
  if (key === "Escape") return "cancel";
  if (key === "Enter") return field === "notes" && shiftKey ? null : "commit";
  return null;
};
