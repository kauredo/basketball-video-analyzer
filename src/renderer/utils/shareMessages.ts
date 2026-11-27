import type { TFunction } from "i18next";
import { causeOf, errorCode } from "./errors";
import type { HeldBack } from "../../shared/shareReview";

/** The file name main appends after the error code. */
export const detail = (error: unknown, code: string): string =>
  causeOf(error)?.split(code)[1]?.trim() ?? "";

/** The message for a shared project that could not be opened or applied. */
export const openSharedError = (t: TFunction, error: unknown, fallback = "app.openShared.failed"): string => {
  const code = errorCode(error);
  switch (code) {
    case "INVALID_SESSION_FILE":
      return t("app.projects.importSessionInvalidFile");
    case "ERROR_BUNDLE_FILE_UNSAFE":
      return t("app.openShared.unsafeFile", { name: detail(error, code) });
    case "ERROR_BUNDLE_FILE_CHANGED":
      return t("app.openShared.changedFile", { name: detail(error, code) });
    case "ERROR_BUNDLE_INCOMPLETE":
      return t("app.openShared.incomplete", { name: detail(error, code) });
    case "ERROR_BUNDLE_NO_FINGERPRINT":
      return t("app.openShared.noFingerprint", { name: detail(error, code) });
    case "ERROR_SHARE_FILE_MISSING":
      return t("app.share.fileMissing", { name: detail(error, code) });
    case "ERROR_INSUFFICIENT_SPACE":
      return t("app.openShared.noSpace");
    case "ERROR_SHARE_ID_TAKEN":
      return t("app.review.idTaken");
    case "ERROR_SHARE_ROWS_TAKEN":
      return t("app.review.rowsTaken");
    case "ERROR_REVIEW_STALE":
      return t("app.review.stale");
    default:
      return t(fallback);
  }
};

/** The toast after a merge: deletions that stayed because they are in use, and changes left as they were. */
export const mergedMessage = (t: TFunction, kept: number, heldBack: HeldBack[]): string =>
  [
    kept > 0 ? t("app.review.appliedKept", { count: kept }) : t("app.review.applied"),
    ...heldBack.map(entry => entry.reason === "name"
      ? t("app.review.heldBackName", { name: entry.name, to: entry.to ?? "" })
      : t(entry.reason === "loop" ? "app.review.heldBackLoop" : "app.review.heldBackDepth", { name: entry.name })),
  ].join(" ");
