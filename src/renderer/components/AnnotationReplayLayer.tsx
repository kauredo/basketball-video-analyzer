import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Annotation } from "../../types/global";
import {
  TelestrationShape,
  renderShapes,
  getVideoContentRect,
  VideoContentRect,
} from "../utils/telestration";
import styles from "../styles/AnnotationReplayLayer.module.css";

// How long a saved drawing stays on screen once playback reaches its timestamp.
const REPLAY_DISPLAY_SECONDS = 4;

interface AnnotationReplayLayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  annotations: Annotation[];
  currentTime: number;
  enabled: boolean;
}

const safeParse = (data: string): TelestrationShape[] => {
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? (parsed as TelestrationShape[]) : [];
  } catch {
    return [];
  }
};

// Read-only overlay that redraws saved annotations while the video plays past
// their timestamp. pointer-events: none so it never intercepts video clicks,
// and it renders nothing at all when no annotation is currently active.
export const AnnotationReplayLayer: React.FC<AnnotationReplayLayerProps> = ({
  videoRef,
  containerRef,
  annotations,
  currentTime,
  enabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState<VideoContentRect | null>(null);

  // Parse each annotation's shapes once, not on every timeupdate tick.
  const parsed = useMemo(
    () =>
      annotations.map(a => ({
        timestamp: a.timestamp,
        shapes: safeParse(a.data),
      })),
    [annotations]
  );

  // Membership signature — changes only when the set of active annotations
  // changes, so the shape array (and the redraw below) stays stable between
  // ticks that don't cross an annotation boundary.
  const activeKey = useMemo(
    () =>
      parsed
        .filter(
          p =>
            currentTime >= p.timestamp &&
            currentTime < p.timestamp + REPLAY_DISPLAY_SECONDS
        )
        .map(p => p.timestamp)
        .join(","),
    [parsed, currentTime]
  );

  const activeShapes = useMemo(() => {
    if (!activeKey) return [];
    const times = new Set(activeKey.split(",").map(Number));
    return parsed.filter(p => times.has(p.timestamp)).flatMap(p => p.shapes);
  }, [activeKey, parsed]);

  const hasActive = enabled && activeShapes.length > 0;

  const measure = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    if (!video.videoWidth || !video.videoHeight) return;
    setRect(getVideoContentRect(video, container));
  }, [videoRef, containerRef]);

  useEffect(() => {
    if (!hasActive) return;
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
  }, [hasActive, measure, containerRef, videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rect) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderShapes(ctx, activeShapes, rect.width, rect.height);
  }, [activeShapes, rect]);

  if (!hasActive || !rect) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={styles.canvas}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
};
