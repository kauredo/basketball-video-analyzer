import React, { CSSProperties, RefObject, useRef, useState } from "react";
import { loadPref, savePref, STORAGE_KEYS } from "../utils/storage";

// Where the toolbar sits, as a fraction (0-1) of the room it has to move in
// across and down, so it stays put when the window is resized.
interface ToolbarPosition {
  x: number;
  y: number;
}

const NUDGE_PX = 20;
const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const loadPosition = (): ToolbarPosition | null => {
  const stored = loadPref<ToolbarPosition | null>(
    STORAGE_KEYS.DRAW_TOOLBAR_POSITION,
    null
  );
  return stored && typeof stored.x === "number" && typeof stored.y === "number"
    ? { x: clamp01(stored.x), y: clamp01(stored.y) }
    : null;
};

const savePosition = (position: ToolbarPosition | null) =>
  savePref(STORAGE_KEYS.DRAW_TOOLBAR_POSITION, position);

// Drag, nudge and reset for a toolbar that moves inside `laneRef`. Spread
// `gripProps` on the grip button and `style` on the toolbar.
export function useToolbarDrag(
  toolbarRef: RefObject<HTMLElement>,
  laneRef: RefObject<HTMLElement>
) {
  const [position, setPosition] = useState(loadPosition);
  const latest = useRef(position);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const place = (next: ToolbarPosition | null) => {
    latest.current = next;
    setPosition(next);
  };

  // Puts the toolbar's top-left corner at (left, top) px inside the lane.
  const moveTo = (left: number, top: number) => {
    const lane = laneRef.current?.getBoundingClientRect();
    const bar = toolbarRef.current;
    if (!lane || !bar) return;
    place({
      x: clamp01(left / Math.max(1, lane.width - bar.offsetWidth)),
      y: clamp01(top / Math.max(1, lane.height - bar.offsetHeight)),
    });
  };

  const gripProps = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!e.isPrimary || e.button !== 0) return;
      const bar = toolbarRef.current?.getBoundingClientRect();
      if (!bar) return;
      grab.current = { dx: e.clientX - bar.left, dy: e.clientY - bar.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const lane = laneRef.current?.getBoundingClientRect();
      if (!grab.current || !lane) return;
      moveTo(
        e.clientX - lane.left - grab.current.dx,
        e.clientY - lane.top - grab.current.dy
      );
    },
    onPointerUp: () => {
      if (!grab.current) return;
      grab.current = null;
      savePosition(latest.current);
    },
    onPointerCancel: () => {
      grab.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Home") {
        e.preventDefault();
        place(null);
        savePosition(null);
        return;
      }
      const nudge = NUDGES[e.key];
      if (!nudge) return;
      e.preventDefault();
      const lane = laneRef.current?.getBoundingClientRect();
      const bar = toolbarRef.current?.getBoundingClientRect();
      if (!lane || !bar) return;
      moveTo(
        bar.left - lane.left + nudge[0] * NUDGE_PX,
        bar.top - lane.top + nudge[1] * NUDGE_PX
      );
      savePosition(latest.current);
    },
    onDoubleClick: () => {
      place(null);
      savePosition(null);
    },
  };

  // left: n% with translate(-n%) keeps the toolbar inside the lane at any n.
  const style: CSSProperties | undefined = position
    ? {
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: `translate(${-position.x * 100}%, ${-position.y * 100}%)`,
      }
    : undefined;

  return { gripProps, style };
}
