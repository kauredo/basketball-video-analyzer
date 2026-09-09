import { ClipStatus } from "../../types/global";

export const DONATION_URL = "https://ko-fi.com/kauredo";
export const GITHUB_URL =
  "https://github.com/kauredo/basketball-video-analyzer";
export const DONATION_NUDGE_THRESHOLD = 25;

/** The review states a clip can carry, in the order every control lists them. */
export const CLIP_STATUSES: ClipStatus[] = ["keep", "cut", "review"];

/** i18n key for a status label: "keep" becomes app.clips.table.statusKeep. */
export const statusLabelKey = (status: ClipStatus): string =>
  `app.clips.table.status${status[0].toUpperCase()}${status.slice(1)}`;
