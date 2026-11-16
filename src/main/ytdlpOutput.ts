// yt-dlp output arrives in chunks that can split a line, so progress is read
// one whole line at a time.
export class LineBuffer {
  private rest = "";

  push(chunk: string): string[] {
    const lines = (this.rest + chunk).split(/\r?\n/);
    this.rest = lines.pop() ?? "";
    return lines;
  }
}

export const progressPercent = (line: string): number | null => {
  const match = line.match(/^\[download\]\s+(\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : null;
};

// yt-dlp appends the final file path to a file of our own after it moves the
// download into place, which also covers "has already been downloaded". The
// file is UTF-8 whatever the console code page, so titles with accents survive.
export const lastPrintedPath = (contents: string): string | null =>
  contents.split(/\r?\n/).filter(line => line.trim()).pop() ?? null;

export type DownloadOutcome = "cancelled" | "failed" | { filePath: string };

// A cancel wins over everything, so a run that the user stopped never imports
// a file even if yt-dlp managed to exit cleanly.
export const downloadOutcome = (state: {
  cancelled: boolean;
  failed: boolean;
  filePath: string | null;
  fileExists: boolean;
}): DownloadOutcome => {
  if (state.cancelled) return "cancelled";
  if (state.failed || !state.filePath || !state.fileExists) return "failed";
  return { filePath: state.filePath };
};

// The file argument of --print-to-file is an output template, so a literal %
// in the path has to be doubled.
export const templateLiteral = (filePath: string): string => filePath.replace(/%/g, "%%");
