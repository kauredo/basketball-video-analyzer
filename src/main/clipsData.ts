// The clip list as people read it: names instead of ids. Shared by the CSV and
// JSON export and the zip export.

interface StoredClip {
  title: string;
  categories: string;
  players?: string;
  quarter?: string | null;
  start_time: number;
  end_time: number;
  duration: number;
  notes?: string;
  created_at?: string;
  status?: string | null;
}

export interface ClipRow {
  title: string;
  categories: string[];
  players: string[];
  quarter: string | null;
  start_time: number;
  end_time: number;
  duration: number;
  notes: string;
  created_at: string;
  status: string | null;
}

const ids = (json: string | undefined): number[] => {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const clipRows = (
  clips: StoredClip[],
  categoryNames: Map<number, string>,
  playerNames: Map<number, string>,
): ClipRow[] =>
  clips.map(clip => ({
    title: clip.title,
    categories: ids(clip.categories).map(id => categoryNames.get(id) || "Unknown"),
    players: ids(clip.players).map(id => playerNames.get(id) || "Unknown"),
    quarter: clip.quarter || null,
    start_time: clip.start_time,
    end_time: clip.end_time,
    duration: clip.duration,
    notes: clip.notes || "",
    created_at: clip.created_at || "",
    status: clip.status || null,
  }));

const escapeCsv = (val: string) => {
  // A leading =, +, -, @ makes spreadsheets run the cell as a formula.
  const safeVal = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  if (/[,"\n\r]/.test(safeVal)) {
    return `"${safeVal.replace(/"/g, '""')}"`;
  }
  return safeVal;
};

export const clipsCsv = (rows: ClipRow[]): string => {
  const header = "Title,Categories,Players,Quarter,Start Time,End Time,Duration,Notes,Created At,Status";
  const lines = rows.map(row =>
    [
      escapeCsv(row.title),
      escapeCsv(row.categories.join("; ")),
      escapeCsv(row.players.join("; ")),
      escapeCsv(row.quarter || ""),
      row.start_time.toFixed(2),
      row.end_time.toFixed(2),
      row.duration.toFixed(2),
      escapeCsv(row.notes),
      row.created_at,
      escapeCsv(row.status || ""),
    ].join(","),
  );
  return [header, ...lines].join("\n");
};

export const clipsJson = (rows: ClipRow[]): string => JSON.stringify(rows, null, 2);
