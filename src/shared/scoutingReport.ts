// The scouting report as one self-contained HTML page, which the main process
// prints to PDF. Every value is escaped: the page shows the coach's own text,
// but it is still text, never markup.

export interface ReportLabels {
  title: string;
  madeWith: string;
  totalClips: string;
  totalDuration: string;
  avgDuration: string;
  categoriesUsed: string;
  clipsByCategory: string;
  byQuarter: string;
  byPlayer: string;
  shotChart: string;
  noLocatedClips: string;
  clipList: string;
  time: string;
  clip: string;
  categories: string;
  players: string;
  quarter: string;
  notes: string;
}

export interface ReportData {
  projectName: string;
  videoName: string;
  summary: { clips: string; totalDuration: string; avgDuration: string; categoriesUsed: string };
  byCategory: Array<{ name: string; color: string; count: number; duration: string }>;
  byQuarter: Array<{ label: string; count: number }>;
  byPlayer: Array<{ label: string; count: number }>;
  clips: Array<{ time: string; title: string; categories: string; players: string; quarter: string; notes: string }>;
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeColor = (color: string) => (/^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#0b7972");

const bars = (input: Array<{ label: string; count: number; color?: string; extra?: string }>) => {
  // Counts arrive over IPC, so make sure they are numbers before printing them.
  const rows = input.map(r => ({ ...r, count: Math.max(0, Math.floor(Number(r.count) || 0)) }));
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return `<table class="bars">${rows
    .map(
      r =>
        `<tr><td class="label">${escapeHtml(r.label)}</td><td class="track"><span style="width:${
          max > 0 ? Math.round((r.count / max) * 100) : 0
        }%;background:${safeColor(r.color ?? "")}"></span></td><td class="num">${r.count}${
          r.extra ? ` · ${escapeHtml(r.extra)}` : ""
        }</td></tr>`
    )
    .join("")}</table>`;
};

/** `shotChartSvg` must come from courtSvg, which escapes what it draws. */
export const scoutingReportHtml = (data: ReportData, labels: ReportLabels, shotChartSvg: string | null): string => {
  const summary = [
    [labels.totalClips, data.summary.clips],
    [labels.totalDuration, data.summary.totalDuration],
    [labels.avgDuration, data.summary.avgDuration],
    [labels.categoriesUsed, data.summary.categoriesUsed],
  ]
    .map(([k, v]) => `<div class="card"><div class="value">${escapeHtml(v)}</div><div class="key">${escapeHtml(k)}</div></div>`)
    .join("");

  const clipRows = data.clips
    .map(
      c =>
        `<tr><td class="nowrap">${escapeHtml(c.time)}</td><td>${escapeHtml(c.title)}</td><td>${escapeHtml(
          c.categories
        )}</td><td>${escapeHtml(c.players)}</td><td>${escapeHtml(c.quarter)}</td><td>${escapeHtml(c.notes)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(labels.title)}: ${escapeHtml(data.projectName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1f1f1f; font-size: 11px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d6d6d6; }
  .sub { color: #5b5b5b; margin: 0 0 16px; }
  .cards { display: flex; gap: 8px; }
  .card { flex: 1; border: 1px solid #d6d6d6; border-radius: 6px; padding: 8px 10px; }
  .value { font-size: 18px; font-weight: bold; }
  .key { color: #5b5b5b; }
  .bars { width: 100%; border-collapse: collapse; }
  .bars td { padding: 3px 0; }
  .bars .label { width: 30%; padding-right: 8px; }
  .bars .track span { display: block; height: 10px; border-radius: 3px; min-width: 1px; }
  .bars .num { width: 16%; text-align: right; color: #3d3d3d; padding-left: 8px; white-space: nowrap; }
  .chart { width: 62%; margin: 0 auto; }
  .chart svg { width: 100%; height: auto; }
  .clips { width: 100%; border-collapse: collapse; }
  .clips th { text-align: left; border-bottom: 1px solid #9a9a9a; padding: 4px 6px 4px 0; }
  .clips td { border-bottom: 1px solid #e6e6e6; padding: 4px 6px 4px 0; vertical-align: top; }
  .clips tr { break-inside: avoid; }
  .nowrap { white-space: nowrap; }
  .muted { color: #5b5b5b; }
  .page-break { break-before: page; }
</style></head><body>
<h1>${escapeHtml(data.projectName)}</h1>
<p class="sub">${escapeHtml(labels.title)} · ${escapeHtml(data.videoName)} · ${escapeHtml(labels.madeWith)}</p>
<div class="cards">${summary}</div>
<h2>${escapeHtml(labels.clipsByCategory)}</h2>
${bars(data.byCategory.map(r => ({ label: r.name, count: r.count, color: r.color, extra: r.duration })))}
<h2>${escapeHtml(labels.byQuarter)}</h2>
${bars(data.byQuarter)}
${data.byPlayer.length ? `<h2>${escapeHtml(labels.byPlayer)}</h2>${bars(data.byPlayer)}` : ""}
<h2 class="page-break">${escapeHtml(labels.shotChart)}</h2>
${shotChartSvg ? `<div class="chart">${shotChartSvg}</div>` : `<p class="muted">${escapeHtml(labels.noLocatedClips)}</p>`}
<h2>${escapeHtml(labels.clipList)}</h2>
<table class="clips"><thead><tr><th>${escapeHtml(labels.time)}</th><th>${escapeHtml(labels.clip)}</th><th>${escapeHtml(
    labels.categories
  )}</th><th>${escapeHtml(labels.players)}</th><th>${escapeHtml(labels.quarter)}</th><th>${escapeHtml(
    labels.notes
  )}</th></tr></thead><tbody>${clipRows}</tbody></table>
</body></html>`;
};

const MAX_ROWS = 5000;
const str = (v: unknown, max = 2000) => String(v ?? "").slice(0, max);
const list = <T>(v: unknown, map: (item: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.slice(0, MAX_ROWS).map(item => map((item ?? {}) as Record<string, unknown>)) : [];

/** Coerces what the renderer sent into the report's shape, so the builder only sees strings and numbers. */
export const normalizeReport = (input: unknown): { data: ReportData; labels: ReportLabels } => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const d = (raw.data ?? {}) as Record<string, unknown>;
  const s = (d.summary ?? {}) as Record<string, unknown>;
  const l = (raw.labels ?? {}) as Record<string, unknown>;
  const labelKeys: (keyof ReportLabels)[] = [
    "title", "madeWith", "totalClips", "totalDuration", "avgDuration", "categoriesUsed",
    "clipsByCategory", "byQuarter", "byPlayer", "shotChart", "noLocatedClips", "clipList",
    "time", "clip", "categories", "players", "quarter", "notes",
  ];
  const labels = Object.fromEntries(labelKeys.map(k => [k, str(l[k], 200)])) as unknown as ReportLabels;
  const count = (v: unknown) => Number(v) || 0;
  return {
    labels,
    data: {
      projectName: str(d.projectName, 200),
      videoName: str(d.videoName, 300),
      summary: {
        clips: str(s.clips, 20),
        totalDuration: str(s.totalDuration, 20),
        avgDuration: str(s.avgDuration, 20),
        categoriesUsed: str(s.categoriesUsed, 20),
      },
      byCategory: list(d.byCategory, r => ({ name: str(r.name, 200), color: str(r.color, 20), count: count(r.count), duration: str(r.duration, 20) })),
      byQuarter: list(d.byQuarter, r => ({ label: str(r.label, 50), count: count(r.count) })),
      byPlayer: list(d.byPlayer, r => ({ label: str(r.label, 200), count: count(r.count) })),
      clips: list(d.clips, r => ({
        time: str(r.time, 20),
        title: str(r.title, 300),
        categories: str(r.categories, 500),
        players: str(r.players, 500),
        quarter: str(r.quarter, 50),
        notes: str(r.notes),
      })),
    },
  };
};
