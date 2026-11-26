// The header's Tag / Study / Scout layout presets: their sizes, the clamp that
// fits them to the window, and the selected/edited state. Kept free of React
// and of localStorage so `npm test` can run it with type stripping.

import type { ListWidth } from "./clipList";

export type LayoutPresetId = "tag" | "study" | "scout";
export const LAYOUT_PRESET_IDS: readonly LayoutPresetId[] = ["tag", "study", "scout"];

export interface PresetLayout {
  sidePanelWidth: number;
  bottomPanelHeight: number;
  bottomListWidth: ListWidth;
}

export const LAYOUT_PRESETS: Record<LayoutPresetId, PresetLayout> = {
  tag: { sidePanelWidth: 520, bottomPanelHeight: 240, bottomListWidth: "narrow" },
  study: { sidePanelWidth: 360, bottomPanelHeight: 380, bottomListWidth: "full" },
  scout: { sidePanelWidth: 300, bottomPanelHeight: 200, bottomListWidth: "wide" },
};

// Mirrors of limits that live elsewhere. Change these when the source changes.
export const SIDE_MIN = 280, SIDE_MAX = 600; // startSideResize clamp in App.tsx
export const BOTTOM_MIN = 200, BOTTOM_MAX = 600; // startBottomResize clamp in App.tsx
export const VIDEO_SECTION_MIN_HEIGHT = 460; // --video-section-min-height in variables.css
// Room for a 360px-tall 16:9 film plus the bottom list and timeline side by side.
export const MIN_FILM_COLUMN = 640;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const usable = (n: number) => Number.isFinite(n) && n > 0;

/** The preset's sizes fitted to a `<main>` of the given size. */
export function presetLayoutFor(id: LayoutPresetId, main: { width: number; height: number }): PresetLayout {
  const preset = LAYOUT_PRESETS[id];
  const sideMax = usable(main.width) ? Math.max(SIDE_MIN, Math.min(SIDE_MAX, main.width - MIN_FILM_COLUMN)) : SIDE_MAX;
  const bottomMax = usable(main.height)
    ? Math.min(BOTTOM_MAX, Math.max(BOTTOM_MIN, main.height - VIDEO_SECTION_MIN_HEIGHT))
    : BOTTOM_MAX;
  return {
    sidePanelWidth: clamp(preset.sidePanelWidth, SIDE_MIN, sideMax),
    bottomPanelHeight: clamp(preset.bottomPanelHeight, BOTTOM_MIN, bottomMax),
    bottomListWidth: preset.bottomListWidth,
  };
}

export interface PresetState { selected: LayoutPresetId | null; edited: boolean }
export const INITIAL_PRESET_STATE: PresetState = { selected: null, edited: false };
export type PresetAction = { type: "apply"; id: LayoutPresetId } | { type: "manualChange" };

export function presetReducer(state: PresetState, action: PresetAction): PresetState {
  if (action.type === "apply") return { selected: action.id, edited: false };
  // Same object back when nothing changes, so React skips the re-render.
  if (state.selected === null || state.edited) return state;
  return { selected: state.selected, edited: true };
}

/** A stored value from an older build or a hand edit falls back to no preset. */
export function parsePresetState(raw: unknown): PresetState {
  if (typeof raw !== "object" || raw === null) return INITIAL_PRESET_STATE;
  const { selected, edited } = raw as { selected?: unknown; edited?: unknown };
  if (typeof edited !== "boolean") return INITIAL_PRESET_STATE;
  if (selected === null) return INITIAL_PRESET_STATE;
  if (!(LAYOUT_PRESET_IDS as readonly unknown[]).includes(selected)) return INITIAL_PRESET_STATE;
  return { selected: selected as LayoutPresetId, edited };
}
