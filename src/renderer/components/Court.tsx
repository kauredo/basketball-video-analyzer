import React from "react";
import styles from "../styles/Court.module.css";

// Schematic half-court, baseline at the top. Coordinate space is the viewBox
// (0..500 wide, 0..470 tall). Positions are normalized 0-1: x left->right,
// y baseline->half-court line.
export const COURT_VB_W = 500;
export const COURT_VB_H = 470;

interface CourtProps {
  // Picker mode: current selection (normalized 0-1) shown as a crosshair.
  marker?: { x: number; y: number } | null;
  // Picker mode: click handler. Omit for display-only (chart) mode.
  onSelect?: (pos: { x: number; y: number }) => void;
  // Display mode: dot elements positioned in viewBox units.
  children?: React.ReactNode;
}

export const Court: React.FC<CourtProps> = ({ marker, onSelect, children }) => {
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
      style={{ width: "100%", height: "auto", display: "block" }}
      onClick={onSelect ? handleClick : undefined}
      role={onSelect ? "button" : "img"}
    >
      <g className={styles.lines}>
        {/* Court boundary */}
        <rect x="2" y="2" width="496" height="466" rx="4" />
        {/* Backboard + hoop (baseline at top) */}
        <line x1="220" y1="40" x2="280" y2="40" />
        <circle cx="250" cy="52" r="7.5" />
        {/* Paint / key */}
        <rect x="170" y="2" width="160" height="190" />
        {/* Free-throw circle */}
        <circle cx="250" cy="192" r="60" />
        {/* Three-point line: corners then arc */}
        <line x1="30" y1="2" x2="30" y2="92" />
        <line x1="470" y1="2" x2="470" y2="92" />
        <path d="M 30 92 A 225 225 0 0 0 470 92" />
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
