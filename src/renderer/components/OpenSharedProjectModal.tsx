import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faFolderOpen, faSpinner } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ShareProjectModal.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { errorCode } from "../utils/errors";
import { mergedMessage, openSharedError } from "../utils/shareMessages";
import { formatBytes } from "./ShareProjectModal";
import { ShareProgress } from "../../types/global";
import type { OpenSharedResult } from "../../shared/shareReview";
import type { Project } from "./ProjectSelector";

interface OpenSharedProjectModalProps {
  /** What main found in the folder: the bundled videos' total, and whether they fit on this computer. */
  choice: { videoBytes: number; canCopy: boolean };
  /** Runs the import with the coach's choice; a review passes its apply here. */
  finish: (copyVideos: boolean) => Promise<OpenSharedResult>;
  /** The message key when `finish` fails for a reason without a message of its own. */
  failure: string;
  onImported: (project: Project) => void;
  onClose: () => void;
}

export const OpenSharedProjectModal: React.FC<OpenSharedProjectModalProps> = ({
  choice, finish, failure, onImported, onClose,
}) => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showInfo, showError } = useToastContext();
  const trapRef = useFocusTrap(true);
  const [canCopy, setCanCopy] = useState(choice.canCopy);
  const [copyVideos, setCopyVideos] = useState(choice.canCopy);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setImporting(true);
    try {
      const result = await finish(copyVideos);
      if (result.status === "imported") {
        showSuccess(t("app.projects.importSessionSuccess"));
        onImported(result.project);
      } else if (result.status === "merged") {
        showSuccess(mergedMessage(t, result.kept, result.heldBack));
        onImported(result.project);
      }
      onClose();
    } catch (err) {
      const code = errorCode(err);
      if (code === "ERROR_INSUFFICIENT_SPACE") {
        // Main keeps the import, so the coach can still use the videos where they are.
        setError(t("app.openShared.noSpace"));
        if (copyVideos) {
          setCanCopy(false);
          setCopyVideos(false);
        }
        return;
      }
      if (code === "ERROR_IMPORT_CANCELLED") {
        showInfo(t("app.openShared.cancelled"));
      } else {
        showError(openSharedError(t, err, failure));
      }
      window.electronAPI.discardSharedProject();
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
                disabled={!canCopy}
                data-autofocus={choice.canCopy || undefined}
                onChange={() => setCopyVideos(true)}
              />
              {t("app.openShared.copyVideos")}
            </label>
            {!canCopy && <p className={styles.hint}>{t("app.openShared.copyNoSpace")}</p>}
            <label className={styles.checkbox}>
              <input
                type="radio"
                name="shared-videos"
                checked={!copyVideos}
                onChange={() => setCopyVideos(false)}
                data-autofocus={!choice.canCopy || undefined}
              />
              {t("app.openShared.useInPlace")}
            </label>
            <p className={styles.hint}>{t("app.openShared.useInPlaceWarning")}</p>
          </fieldset>

          {error && <p className={styles.error} role="alert">{error}</p>}

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
