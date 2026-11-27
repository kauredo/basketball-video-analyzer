import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faFolderOpen, faSpinner } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ShareProjectModal.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { errorCode } from "../utils/errors";
import { detail, formatBytes } from "./ShareProjectModal";
import { ShareProgress } from "../../types/global";
import type { Project } from "./ProjectSelector";

/** The message for a shared project that could not be opened. */
export const openSharedError = (t: TFunction, error: unknown): string => {
  const code = errorCode(error);
  switch (code) {
    case "INVALID_SESSION_FILE":
      return t("app.projects.importSessionInvalidFile");
    case "ERROR_BUNDLE_FILE_UNSAFE":
      return t("app.openShared.unsafeFile", { name: detail(error, code) });
    case "ERROR_BUNDLE_FILE_CHANGED":
      return t("app.openShared.changedFile", { name: detail(error, code) });
    case "ERROR_SHARE_FILE_MISSING":
      return t("app.share.fileMissing", { name: detail(error, code) });
    case "ERROR_INSUFFICIENT_SPACE":
      return t("app.openShared.noSpace");
    default:
      return t("app.openShared.failed");
  }
};

interface OpenSharedProjectModalProps {
  /** What main found in the folder: the bundled videos' total, and whether they fit on this computer. */
  choice: { videoBytes: number; canCopy: boolean };
  onImported: (project: Project) => void;
  onClose: () => void;
}

export const OpenSharedProjectModal: React.FC<OpenSharedProjectModalProps> = ({ choice, onImported, onClose }) => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showInfo, showError } = useToastContext();
  const trapRef = useFocusTrap(true);
  const [copyVideos, setCopyVideos] = useState(choice.canCopy);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ShareProgress | null>(null);

  useEffect(() => {
    window.electronAPI.onImportProgress(setProgress);
    return () => window.electronAPI.removeAllListeners("import-progress");
  }, []);

  const close = () => {
    if (importing) return;
    window.electronAPI.discardSharedProject();
    onClose();
  };

  const open = async () => {
    setProgress(null);
    setImporting(true);
    try {
      const result = await window.electronAPI.finishSharedProject(copyVideos);
      if (result.status === "imported") {
        showSuccess(t("app.projects.importSessionSuccess"));
        onImported(result.project);
      }
      onClose();
    } catch (err) {
      const code = errorCode(err);
      if (code === "ERROR_IMPORT_CANCELLED") {
        showInfo(t("app.openShared.cancelled"));
      } else {
        showError(openSharedError(t, err));
      }
      onClose();
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const percent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.max(0, Math.round((progress.copiedBytes / progress.totalBytes) * 100)))
    : 0;

  return createPortal(
    <div
      ref={trapRef}
      className={styles.overlay}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-shared-title"
      onKeyDown={e => {
        if (e.key !== "Escape") return;
        // The portal still bubbles to the project selector, which would close too.
        e.stopPropagation();
        close();
      }}
    >
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 id="open-shared-title">
            <FontAwesomeIcon icon={faFolderOpen} /> {t("app.openShared.title")}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={close}
            disabled={importing}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={styles.content}>
          <fieldset className={styles.choices} disabled={importing}>
            <legend className={styles.intro}>
              {t("app.openShared.intro", { size: formatBytes(choice.videoBytes, i18n.language) })}
            </legend>
            <label className={styles.checkbox}>
              <input
                type="radio"
                name="shared-videos"
                checked={copyVideos}
                disabled={!choice.canCopy}
                onChange={() => setCopyVideos(true)}
              />
              {t("app.openShared.copyVideos")}
            </label>
            {!choice.canCopy && <p className={styles.hint}>{t("app.openShared.copyNoSpace")}</p>}
            <label className={styles.checkbox}>
              <input
                type="radio"
                name="shared-videos"
                checked={!copyVideos}
                onChange={() => setCopyVideos(false)}
              />
              {t("app.openShared.useInPlace")}
            </label>
            <p className={styles.hint}>{t("app.openShared.useInPlaceWarning")}</p>
          </fieldset>

          {importing && progress && (
            <div className={styles.progress}>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={t("app.share.copying")}
              >
                <div className={styles.progressFill} style={{ width: `${percent}%` }} />
              </div>
              <p className={styles.progressLabel}>
                {t("app.share.progress", {
                  copied: formatBytes(progress.copiedBytes, i18n.language),
                  total: formatBytes(progress.totalBytes, i18n.language),
                  files: progress.copiedFiles,
                  fileCount: progress.totalFiles,
                })}
              </p>
            </div>
          )}

          <div className={styles.actions}>
            {importing ? (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => window.electronAPI.cancelSharedImport()}
                disabled={!progress}
              >
                {t("app.buttons.cancel")}
              </button>
            ) : (
              <button type="button" className={styles.cancelButton} onClick={close}>
                {t("app.buttons.cancel")}
              </button>
            )}
            <button type="button" className={styles.primaryButton} onClick={open} disabled={importing}>
              <FontAwesomeIcon icon={importing ? faSpinner : faFolderOpen} spin={importing} />
              {importing ? t("app.share.copying") : t("app.openShared.open")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
