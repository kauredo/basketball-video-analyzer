import React, {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPen,
  faArrowRightLong,
  faMinus,
  faSquare,
  faCircle,
  faFont,
  faRotateLeft,
  faTrash,
  faCamera,
  faBookmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/Telestration.module.css";
import {
  TelestrationShape,
  TelestrationTool,
  NormPoint,
  VideoContentRect,
  TELESTRATION_COLORS,
  TELESTRATION_WIDTHS,
  DEFAULT_TEXT_FRAC,
  renderShapes,
  getVideoContentRect,
} from "../utils/telestration";

interface TelestrationLayerProps {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLElement>;
  shapes: TelestrationShape[];
  onShapesChange: (shapes: TelestrationShape[]) => void;
  onSaveStill: () => void;
  onSaveAnnotation?: () => void;
  onClose: () => void;
  saving: boolean;
}

const TOOLS: { tool: TelestrationTool; icon: typeof faPen; labelKey: string }[] =
  [
    { tool: "pen", icon: faPen, labelKey: "app.telestration.tools.pen" },
    { tool: "arrow", icon: faArrowRightLong, labelKey: "app.telestration.tools.arrow" },
    { tool: "line", icon: faMinus, labelKey: "app.telestration.tools.line" },
    { tool: "rect", icon: faSquare, labelKey: "app.telestration.tools.rect" },
    { tool: "ellipse", icon: faCircle, labelKey: "app.telestration.tools.ellipse" },
    { tool: "text", icon: faFont, labelKey: "app.telestration.tools.text" },
  ];

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const TelestrationLayer: React.FC<TelestrationLayerProps> = ({
  active,
  videoRef,
  containerRef,
  shapes,
  onShapesChange,
  onSaveStill,
  onSaveAnnotation,
  onClose,
  saving,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState<VideoContentRect | null>(null);
  const [tool, setTool] = useState<TelestrationTool>("arrow");
  const [color, setColor] = useState(TELESTRATION_COLORS[0].hex);
  const [widthFrac, setWidthFrac] = useState(TELESTRATION_WIDTHS[1]);
  const [draft, setDraft] = useState<TelestrationShape | null>(null);
  const [textDraft, setTextDraft] = useState<{ at: NormPoint; value: string } | null>(
    null
  );

  // Keep the canvas aligned to the painted video rectangle (object-fit: contain).
  const measure = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    // Wait for video metadata; before it loads videoWidth/Height are 0 and the
    // letterbox math can't produce the true content rect.
    if (!video.videoWidth || !video.videoHeight) return;
    setRect(getVideoContentRect(video, container));
  }, [videoRef, containerRef]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
    const container = containerRef.current;
    const video = videoRef.current;
    const observer = new ResizeObserver(measure);
    if (container) observer.observe(container);
    if (video) observer.observe(video);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, measure, containerRef, videoRef]);

  // Redraw whenever shapes, the in-progress draft, or the size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rect) return;
    const dpr = window.devicePixelRatio || 1;
    // Assigning canvas.width/height clears the bitmap, so only do it when the
    // pixel size actually changes — otherwise every pointer move would flicker.
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const all = draft ? [...shapes, draft] : shapes;
    renderShapes(ctx, all, rect.width, rect.height);
  }, [shapes, draft, rect]);

  const toNorm = useCallback(
    (clientX: number, clientY: number): NormPoint => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const r = canvas.getBoundingClientRect();
      return {
        x: clamp01((clientX - r.left) / r.width),
        y: clamp01((clientY - r.top) / r.height),
      };
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (textDraft) return; // committing text; ignore canvas presses
    const p = toNorm(e.clientX, e.clientY);
    if (tool === "text") {
      setTextDraft({ at: p, value: "" });
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (tool === "pen") {
      setDraft({ id: genId(), tool, color, widthFrac, points: [p] });
    } else {
      setDraft({ id: genId(), tool, color, widthFrac, from: p, to: p });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = toNorm(e.clientX, e.clientY);
    if (draft.tool === "pen") {
      setDraft({ ...draft, points: [...(draft.points ?? []), p] });
    } else {
      setDraft({ ...draft, to: p });
    }
  };

  const commitDraft = () => {
    if (!draft) return;
    const valid =
      draft.tool === "pen"
        ? (draft.points?.length ?? 0) > 1
        : draft.from &&
          draft.to &&
          (Math.abs(draft.from.x - draft.to.x) > 0.003 ||
            Math.abs(draft.from.y - draft.to.y) > 0.003);
    if (valid) onShapesChange([...shapes, draft]);
    setDraft(null);
  };

  const commitText = () => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    if (value) {
      onShapesChange([
        ...shapes,
        {
          id: genId(),
          tool: "text",
          color,
          widthFrac,
          text: value,
          at: textDraft.at,
          fontFrac: DEFAULT_TEXT_FRAC,
        },
      ]);
    }
    setTextDraft(null);
  };

  const undo = () => {
    if (shapes.length > 0) onShapesChange(shapes.slice(0, -1));
  };

  const clearAll = () => {
    setDraft(null);
    setTextDraft(null);
    onShapesChange([]);
  };

  // Exit on Escape (after dismissing any in-progress text input).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (textDraft) {
        setTextDraft(null);
        e.stopPropagation();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, textDraft, onClose]);

  if (!active || !rect) {
    return active ? (
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />
    ) : null;
  }

  const textPx = textDraft
    ? {
        left: rect.left + textDraft.at.x * rect.width,
        top: rect.top + textDraft.at.y * rect.height,
        fontSize: Math.max(12, DEFAULT_TEXT_FRAC * rect.height),
      }
    : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          cursor: tool === "text" ? "text" : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitDraft}
        onPointerCancel={commitDraft}
      />

      {textPx && (
        <input
          autoFocus
          type="text"
          className={styles.textInput}
          style={{
            left: textPx.left,
            top: textPx.top,
            fontSize: textPx.fontSize,
            color,
          }}
          value={textDraft!.value}
          onChange={e =>
            setTextDraft({ at: textDraft!.at, value: e.target.value })
          }
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            }
          }}
          placeholder={t("app.telestration.textPlaceholder")}
        />
      )}

      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label={t("app.telestration.title")}
      >
        <div className={styles.toolGroup}>
          {TOOLS.map(ti => (
            <button
              key={ti.tool}
              type="button"
              className={`${styles.toolBtn} ${
                tool === ti.tool ? styles.toolBtnActive : ""
              }`}
              onClick={() => setTool(ti.tool)}
              title={t(ti.labelKey)}
              aria-label={t(ti.labelKey)}
              aria-pressed={tool === ti.tool}
            >
              <FontAwesomeIcon icon={ti.icon} />
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          {TELESTRATION_COLORS.map(c => (
            <button
              key={c.hex}
              type="button"
              className={`${styles.colorBtn} ${
                color === c.hex ? styles.colorBtnActive : ""
              }`}
              style={{ backgroundColor: c.hex }}
              onClick={() => setColor(c.hex)}
              title={c.name}
              aria-label={c.name}
              aria-pressed={color === c.hex}
            />
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          {TELESTRATION_WIDTHS.map((w, i) => (
            <button
              key={w}
              type="button"
              className={`${styles.widthBtn} ${
                widthFrac === w ? styles.widthBtnActive : ""
              }`}
              onClick={() => setWidthFrac(w)}
              title={t(`app.telestration.widths.${["thin", "medium", "thick"][i]}`)}
              aria-label={t(
                `app.telestration.widths.${["thin", "medium", "thick"][i]}`
              )}
              aria-pressed={widthFrac === w}
            >
              <span
                className={styles.widthDot}
                style={{ width: 4 + i * 4, height: 4 + i * 4 }}
              />
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={undo}
            disabled={shapes.length === 0}
            title={t("app.telestration.undo")}
            aria-label={t("app.telestration.undo")}
          >
            <FontAwesomeIcon icon={faRotateLeft} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={clearAll}
            disabled={shapes.length === 0}
            title={t("app.telestration.clear")}
            aria-label={t("app.telestration.clear")}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
          {onSaveAnnotation && (
            <button
              type="button"
              className={`${styles.toolBtn} ${styles.saveBtn}`}
              onClick={onSaveAnnotation}
              disabled={shapes.length === 0}
              title={t("app.telestration.saveAnnotation")}
              aria-label={t("app.telestration.saveAnnotation")}
            >
              <FontAwesomeIcon icon={faBookmark} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.saveBtn}`}
            onClick={onSaveStill}
            disabled={shapes.length === 0 || saving}
            title={t("app.telestration.saveStill")}
            aria-label={t("app.telestration.saveStill")}
          >
            <FontAwesomeIcon icon={faCamera} />
          </button>
        </div>

        <div className={styles.divider} />

        <button
          type="button"
          className={`${styles.toolBtn} ${styles.closeBtn}`}
          onClick={onClose}
          title={t("app.telestration.done")}
          aria-label={t("app.telestration.done")}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </>
  );
};
