// Keeps `${title}_${timestamp}_${id}_thumb.jpg` under the 255-byte filename limit.
const MAX_FILE_TITLE_CHARS = 80;

/** Error code for times or a title a clip can't be cut from, or null when they are usable. */
export const clipInputError = (
  startTime: unknown,
  endTime: unknown,
  title: unknown,
): string | null => {
  if (typeof title !== "string") return "ERROR_INVALID_TITLE";
  if (
    typeof startTime !== "number" ||
    typeof endTime !== "number" ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return "ERROR_INVALID_TIME";
  }
  if (endTime - startTime <= 0) return "ERROR_INVALID_DURATION";
  if (startTime < 0 || endTime < 0) return "ERROR_INVALID_TIME";
  if (title.trim().length === 0) return "ERROR_INVALID_TITLE";
  return null;
};

export const clipFileTitle = (title: string): string =>
  title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, MAX_FILE_TITLE_CHARS);
