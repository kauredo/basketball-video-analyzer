// The half-court as plain data, drawn by the Court component on screen and as
// a standalone SVG string for the shot chart image and the scouting report.
// Baseline at the top; positions are normalized 0-1 (x left to right, y
// baseline to half-court line) and scaled to the viewBox.

export const COURT_VB_W = 500;
export const COURT_VB_H = 470;

export type CourtShape =
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { tag: "line"; x1: number; y1: number; x2: number; y2: number }
  | { tag: "circle"; cx: number; cy: number; r: number }
  | { tag: "path"; d: string };

export const COURT_LINES: CourtShape[] = [
  { tag: "rect", x: 2, y: 2, width: 496, height: 466, rx: 4 }, // boundary
  { tag: "line", x1: 220, y1: 40, x2: 280, y2: 40 }, // backboard
  { tag: "circle", cx: 250, cy: 52, r: 7.5 }, // hoop
  { tag: "rect", x: 170, y: 2, width: 160, height: 190 }, // paint
  { tag: "circle", cx: 250, cy: 192, r: 60 }, // free-throw circle
  { tag: "line", x1: 30, y1: 2, x2: 30, y2: 92 }, // three-point corners
  { tag: "line", x1: 470, y1: 2, x2: 470, y2: 92 },
  { tag: "path", d: "M 30 92 A 225 225 0 0 0 470 92" }, // three-point arc
];

export interface CourtDot {
  x: number;
  y: number;
  color: string;
  label: string;
}

export interface CourtLegendItem {
  color: string;
  label: string;
}

export interface CourtSvgOptions {
  background: string;
  lines: string;
  text: string;
  legend?: CourtLegendItem[];
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Colors land in attributes of a standalone file, so only plain hex passes.
const safeColor = (color: string, fallback: string) =>
  /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const shapeMarkup = (s: CourtShape): string => {
  const attrs = Object.entries(s)
    .filter(([k]) => k !== "tag")
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(" ");
  return `<${s.tag} ${attrs}/>`;
};

const LEGEND_ROW = 26;

/** Height of the image courtSvg draws for a legend of this many items. */
export const courtSvgHeight = (legendItems: number): number =>
  COURT_VB_H + (legendItems ? 16 + legendItems * LEGEND_ROW : 0);

/** A self-contained SVG of the court with dots, and a legend under it. */
export const courtSvg = (dots: CourtDot[], options: CourtSvgOptions): string => {
  const legend = options.legend ?? [];
  const height = courtSvgHeight(legend.length);
  const fallback = safeColor(options.lines, "#555555");
  const lines = COURT_LINES.map(shapeMarkup).join("");
  const circles = dots
    .map(
      d =>
        `<circle cx="${clamp01(d.x) * COURT_VB_W}" cy="${clamp01(d.y) * COURT_VB_H}" r="8" fill="${safeColor(d.color, fallback)}" fill-opacity="0.85" stroke="${safeColor(options.background, "#ffffff")}" stroke-width="1"><title>${escapeXml(d.label)}</title></circle>`
    )
    .join("");
  const legendRows = legend
    .map((item, i) => {
      const y = COURT_VB_H + 16 + i * LEGEND_ROW;
      return `<circle cx="20" cy="${y + 9}" r="7" fill="${safeColor(item.color, fallback)}"/><text x="36" y="${y + 14}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="${safeColor(options.text, "#222222")}">${escapeXml(item.label)}</text>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COURT_VB_W} ${height}" width="${COURT_VB_W}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${safeColor(options.background, "#ffffff")}"/>` +
    `<g fill="none" stroke="${fallback}" stroke-width="2">${lines}</g>` +
    circles +
    legendRows +
    `</svg>`
  );
};
