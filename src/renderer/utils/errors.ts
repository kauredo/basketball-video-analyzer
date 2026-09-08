/**
 * The app used to catch an error, log the cause to the console, and show the
 * user a message with none: "Error deleting clip." and nothing else. That
 * pattern was at 21 call sites. The console line is for whoever is debugging;
 * a coach whose export just failed needs to know it was a full disk and not a
 * missing file.
 *
 * `withCause` appends the underlying message to an already-translated string,
 * so the locale files do not need a placeholder in every error key. The cause
 * itself is not translatable anyway: it is a file path, an errno, or a SQLite
 * message.
 */

/** The longest cause worth putting in a toast. Past this it stops being read. */
const MAX_CAUSE = 160;

/** A readable one-line message from anything a catch block might hand us. */
export function causeOf(error: unknown): string | null {
  let raw: string;
  if (error instanceof Error) raw = error.message;
  else if (typeof error === "string") raw = error;
  else if (error && typeof error === "object" && "message" in error)
    raw = String((error as { message: unknown }).message);
  else return null;

  // Electron wraps main-process throws, so the useful half is after the
  // "Error invoking remote method '...':" prefix. It quotes the method name
  // with either quote style depending on version, hence both here.
  const unwrapped =
    raw.split(/Error invoking remote method\s+['"][^'"]*['"]:\s*/).pop() ?? raw;
  // Node stacks and IPC wrappers both leave "Error: " stems behind.
  const line = unwrapped
    .replace(/^(?:Error:\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  return line.length > MAX_CAUSE ? `${line.slice(0, MAX_CAUSE - 1)}…` : line;
}

/**
 * `message` with the error's cause appended, or `message` alone when the error
 * carries nothing worth showing.
 */
export function withCause(message: string, error: unknown): string {
  const cause = causeOf(error);
  if (!cause) return message;
  const stem = message.replace(/[.\s]+$/, "");
  return `${stem}. ${cause}`;
}
