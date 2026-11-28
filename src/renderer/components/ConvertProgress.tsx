import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilm } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ShareProjectModal.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";

type Progress = { name: string; percent: number | null; seconds: number };

const clock = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Shown while main writes a playable copy, whichever picker started it. */
export const ConvertProgress: React.FC = () => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<Progress | null>(null);
  const trapRef = useFocusTrap(progress !== null);

  useEffect(() => {
    window.electronAPI.onConvertProgress(setProgress);
    return () => window.electronAPI.removeAllListeners("convert-progress");
  }, []);

  if (!progress) return null;
  // A file whose length ffmpeg can't read has no percent, only the time written so far.
  const known = progress.percent !== null;

  return createPortal(
    <div ref={trapRef} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="convert-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 id="convert-title">
            <FontAwesomeIcon icon={faFilm} /> {t("app.convert.title")}
          </h3>
        </div>
        <div className={styles.content}>
          <p className={styles.intro}>{t("app.convert.intro", { name: progress.name })}</p>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={known ? progress.percent ?? 0 : undefined}
            aria-valuetext={known ? undefined : clock(progress.seconds)}
            aria-label={t("app.convert.title")}
          >
            {known && <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />}
          </div>
          <p className={styles.progressLabel}>
            {known
              ? t("app.convert.percent", { percent: progress.percent })
              : t("app.convert.written", { time: clock(progress.seconds) })}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => window.electronAPI.cancelConvert()}
              data-autofocus
            >
              {t("app.buttons.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
