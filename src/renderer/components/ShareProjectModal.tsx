import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faShareNodes, faFolderOpen, faSpinner } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ShareProjectModal.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { errorCode } from "../utils/errors";
import { detail } from "../utils/shareMessages";
import { ShareProgress } from "../../types/global";

interface ShareProjectModalProps {
  isOpen: boolean;
  project: { id: number; name: string };
  onClose: () => void;
}

/** Decimal units, as Finder and Explorer's drive labels show them. */
export const formatBytes = (bytes: number, locale: string): string => {
  const [value, unit] =
    bytes >= 1e9 ? [bytes / 1e9, "gigabyte"] : bytes >= 1e6 ? [bytes / 1e6, "megabyte"] : [bytes / 1e3, "kilobyte"];
  return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
};

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({ isOpen, project, onClose }) => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showInfo } = useToastContext();
  const trapRef = useFocusTrap(isOpen);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [videoBytes, setVideoBytes] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setVideoBytes(null);
    window.electronAPI.getShareSize(project.id).then(setVideoBytes).catch(() => setVideoBytes(null));
    window.electronAPI.onShareProgress(setProgress);
    return () => window.electronAPI.removeAllListeners("share-progress");
  }, [isOpen, project.id]);

  if (!isOpen) return null;

  const close = () => {
    if (!sharing) onClose();
  };

  const share = async () => {
    setError(null);
    setProgress(null);
    setSharing(true);
    try {
      const result = await window.electronAPI.shareProject({ projectId: project.id, includeVideos });
      if (result) {
        showSuccess(t("app.share.success", { name: result.folderName }), 10000, {
          label: t("app.share.showInFolder"),
          onClick: () => window.electronAPI.showSharedProject(),
        });
        onClose();
      }
    } catch (err) {
      const code = errorCode(err);
      if (code === "ERROR_SHARE_CANCELLED") showInfo(t("app.share.cancelled"));
      else if (code === "ERROR_INSUFFICIENT_SPACE") setError(t("app.share.noSpace"));
      else if (code === "ERROR_SHARE_VIDEO_MISSING") setError(t("app.share.videoMissing", { name: detail(err, code) }));
      else if (code === "ERROR_SHARE_FILE_MISSING") setError(t("app.share.fileMissing", { name: detail(err, code) }));
      else if (code === "ERROR_RECEIVED_VIDEO_CHANGED") setError(t("app.video.receivedVideoChanged"));
      else setError(t("app.share.failed"));
    } finally {
      setSharing(false);
      setProgress(null);
    }
  };

  const percent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.max(0, Math.round((progress.copiedBytes / progress.totalBytes) * 100)))
    : 0;

  // Portal to body: the clip library is a containing block for fixed
  // descendants, and its panel can be hidden in some layouts.
  return createPortal(
    <div
      ref={trapRef}
      className={styles.overlay}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-project-title"
      onKeyDown={e => { if (e.key === "Escape") close(); }}
    >
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 id="share-project-title">
            <FontAwesomeIcon icon={faShareNodes} /> {t("app.share.title")}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={close}
            disabled={sharing}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={styles.content}>
          <p className={styles.intro}>{t("app.share.intro")}</p>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={includeVideos}
              disabled={sharing}
              onChange={e => setIncludeVideos(e.target.checked)}
            />
            {videoBytes === null
              ? t("app.share.includeVideosNoSize")
              : t("app.share.includeVideos", { size: formatBytes(videoBytes, i18n.language) })}
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          {sharing && progress && (
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
            {sharing ? (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => window.electronAPI.cancelShare()}
                disabled={!progress}
              >
                {t("app.buttons.cancel")}
              </button>
            ) : (
              <button type="button" className={styles.cancelButton} onClick={close}>
                {t("app.buttons.close")}
              </button>
            )}
            <button type="button" className={styles.primaryButton} onClick={share} disabled={sharing}>
              <FontAwesomeIcon icon={sharing ? faSpinner : faFolderOpen} spin={sharing} />
              {sharing ? t("app.share.copying") : t("app.share.chooseFolder")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
