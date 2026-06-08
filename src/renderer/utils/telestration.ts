// Telestration shape model + rendering.
//
// All coordinates are normalized to [0, 1] relative to the video frame, and
// stroke/font sizes are stored as a fraction of frame height. This keeps a
// drawing resolution-independent: the same data renders to the on-screen
// overlay, to a native-resolution PNG for "save still", and to the ffmpeg
// overlay burned into an exported clip.

export type TelestrationTool =
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text";

export interface NormPoint {
  x: number;
  y: number;
}

export interface TelestrationShape {
  id: string;
  tool: TelestrationTool;
  color: string;
  /** Stroke width as a fraction of frame height. */
  widthFrac: number;
  /** Freehand path (pen). */
  points?: NormPoint[];
  /** Endpoints (line, arrow) or opposite corners (rect, ellipse). */
  from?: NormPoint;
  to?: NormPoint;
  /** Text content + anchor (text). fontFrac is a fraction of frame height. */
  text?: string;
  at?: NormPoint;
  fontFrac?: number;
}

export const TELESTRATION_COLORS: { hex: string; name: string }[] = [
  { hex: "#ff3b30", name: "Red" },
  { hex: "#ffcc00", name: "Yellow" },
  { hex: "#4caf50", name: "Green" },
  { hex: "#2196f3", name: "Blue" },
  { hex: "#ffffff", name: "White" },
  { hex: "#000000", name: "Black" },
];

// Stroke weights as a fraction of frame height (thin / medium / thick).
export const TELESTRATION_WIDTHS = [0.004, 0.007, 0.012];
export const DEFAULT_TEXT_FRAC = 0.05;

const px = (n: number, x: number) => n * x;

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  lineWidth: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = Math.max(lineWidth * 3.5, 8);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/** Draw a single shape onto a context sized to (w, h) pixels. */
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: TelestrationShape,
  w: number,
  h: number
) {
  const lineWidth = Math.max(1, shape.widthFrac * h);
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (shape.tool) {
    case "pen": {
      const pts = shape.points;
      if (!pts || pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(px(pts[0].x, w), px(pts[0].y, h));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(px(pts[i].x, w), px(pts[i].y, h));
      }
      ctx.stroke();
      return;
    }
    case "line":
    case "arrow": {
      if (!shape.from || !shape.to) return;
      const fx = px(shape.from.x, w);
      const fy = px(shape.from.y, h);
      const tx = px(shape.to.x, w);
      const ty = px(shape.to.y, h);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (shape.tool === "arrow") drawArrowHead(ctx, fx, fy, tx, ty, lineWidth);
      return;
    }
    case "rect": {
      if (!shape.from || !shape.to) return;
      const fx = px(shape.from.x, w);
      const fy = px(shape.from.y, h);
      ctx.strokeRect(fx, fy, px(shape.to.x, w) - fx, px(shape.to.y, h) - fy);
      return;
    }
    case "ellipse": {
      if (!shape.from || !shape.to) return;
      const fx = px(shape.from.x, w);
      const fy = px(shape.from.y, h);
      const tx = px(shape.to.x, w);
      const ty = px(shape.to.y, h);
      ctx.beginPath();
      ctx.ellipse(
        (fx + tx) / 2,
        (fy + ty) / 2,
        Math.abs(tx - fx) / 2,
        Math.abs(ty - fy) / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      return;
    }
    case "text": {
      if (!shape.text || !shape.at) return;
      const fontPx = Math.max(8, (shape.fontFrac ?? DEFAULT_TEXT_FRAC) * h);
      ctx.font = `bold ${fontPx}px sans-serif`;
      ctx.textBaseline = "top";
      // Stroke outline for legibility over any background, then fill.
      ctx.lineWidth = Math.max(2, fontPx * 0.12);
      ctx.strokeStyle = shape.color === "#000000" ? "#ffffff" : "#000000";
      ctx.lineJoin = "round";
      ctx.strokeText(shape.text, px(shape.at.x, w), px(shape.at.y, h));
      ctx.fillStyle = shape.color;
      ctx.fillText(shape.text, px(shape.at.x, w), px(shape.at.y, h));
      return;
    }
  }
}

/** Render shapes to a context, clearing it first. */
export function renderShapes(
  ctx: CanvasRenderingContext2D,
  shapes: TelestrationShape[],
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);
  for (const shape of shapes) drawShape(ctx, shape, w, h);
}

/** True if any shape would paint a visible mark. */
function hasDrawing(shapes: TelestrationShape[]): boolean {
  return shapes.some(s => {
    if (s.tool === "pen") return (s.points?.length ?? 0) > 1;
    if (s.tool === "text") return !!s.text?.trim();
    return !!s.from && !!s.to;
  });
}

/**
 * Render shapes to a transparent PNG at native video resolution and return a
 * data URL. Only our own shapes are drawn (never the video frame), so the
 * canvas is never tainted and toDataURL always succeeds.
 */
export function shapesToPngDataUrl(
  shapes: TelestrationShape[],
  videoWidth: number,
  videoHeight: number
): string | null {
  if (!videoWidth || !videoHeight || !hasDrawing(shapes)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  renderShapes(ctx, shapes, videoWidth, videoHeight);
  return canvas.toDataURL("image/png");
}

export interface VideoContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The painted video rectangle inside its element, accounting for
 * object-fit: contain letterboxing, expressed relative to a container element.
 */
export function getVideoContentRect(
  videoEl: HTMLVideoElement,
  containerEl: HTMLElement
): VideoContentRect {
  const vb = videoEl.getBoundingClientRect();
  const cb = containerEl.getBoundingClientRect();
  const elLeft = vb.left - cb.left;
  const elTop = vb.top - cb.top;
  const elW = vb.width;
  const elH = vb.height;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh || !elW || !elH) {
    return { left: elLeft, top: elTop, width: elW, height: elH };
  }
  const vidAR = vw / vh;
  const elAR = elW / elH;
  let cw: number;
  let ch: number;
  if (elAR > vidAR) {
    ch = elH;
    cw = elH * vidAR;
  } else {
    cw = elW;
    ch = elW / vidAR;
  }
  return {
    left: elLeft + (elW - cw) / 2,
    top: elTop + (elH - ch) / 2,
    width: cw,
    height: ch,
  };
}
