import React from "react";
import styles from "../styles/Court.module.css";
import { COURT_LINES, COURT_VB_W, COURT_VB_H } from "../../shared/courtSvg";

// Schematic half-court, baseline at the top. The geometry lives in
// shared/courtSvg so the exported chart image draws the same court.
export { COURT_VB_W, COURT_VB_H };

interface CourtProps {
  // Picker mode: current selection (normalized 0-1) shown as a crosshair.
  marker?: { x: number; y: number } | null;
  // Picker mode: click handler. Omit for display-only (chart) mode.
  onSelect?: (pos: { x: number; y: number }) => void;
  // Display mode: dot elements positioned in viewBox units.
  children?: React.ReactNode;
  // Display mode with focusable children: names the svg as a group, so the
  // children stay reachable by screen readers (role="img" hides them).
  ariaLabel?: string;
  // Overrides the 480px cap in Court.module.css.
  maxWidth?: number;
}

export const Court: React.FC<CourtProps> = ({ marker, onSelect, children, ariaLabel, maxWidth }) => {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onSelect({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    });
  };

  return (
    <svg
      className={styles.court}
      viewBox={`0 0 ${COURT_VB_W} ${COURT_VB_H}`}
      style={{ width: "100%", height: "auto", display: "block", ...(maxWidth ? { maxWidth } : {}) }}
      onClick={onSelect ? handleClick : undefined}
      role={onSelect ? "button" : ariaLabel ? "group" : "img"}
      aria-label={ariaLabel}
    >
      <g className={styles.lines}>
        {COURT_LINES.map(({ tag: Tag, ...attrs }, i) => (
          <Tag key={i} {...(attrs as Record<string, string | number>)} />
        ))}
      </g>

      {children}

      {marker && (
        <g className={styles.marker}>
          <circle cx={marker.x * COURT_VB_W} cy={marker.y * COURT_VB_H} r="10" />
          <line
            x1={marker.x * COURT_VB_W - 14}
            y1={marker.y * COURT_VB_H}
            x2={marker.x * COURT_VB_W + 14}
            y2={marker.y * COURT_VB_H}
          />
          <line
            x1={marker.x * COURT_VB_W}
            y1={marker.y * COURT_VB_H - 14}
            x2={marker.x * COURT_VB_W}
            y2={marker.y * COURT_VB_H + 14}
          />
        </g>
      )}
    </svg>
  );
};
