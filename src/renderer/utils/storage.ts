export const STORAGE_KEYS = {
  SIDE_PANEL_WIDTH: "sidePanelWidth",
  SIDE_PANEL_COLLAPSED: "sidePanelCollapsed",
  BOTTOM_PANEL_HEIGHT: "bottomPanelHeight",
  BOTTOM_PANEL_COLLAPSED: "bottomPanelCollapsed",
  CLIP_SORT_BY: "clipSortBy",
  CLIP_SORT_ORDER: "clipSortOrder",
  ONBOARDING_COMPLETE: "onboardingComplete",
} as const;

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}
