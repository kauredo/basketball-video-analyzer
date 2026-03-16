import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faSpinner } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/YouTubeImport.module.css";

interface YouTubeImportProps {
  onVideoDownloaded: (filePath: string) => void;
}

export const YouTubeImport: React.FC<YouTubeImportProps> = ({
  onVideoDownloaded,
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.onYoutubeDownloadProgress(data => {
      setProgress(data.percent);
    });

    return () => {
      window.electronAPI.removeAllListeners("youtube-download-progress");
    };
  }, []);

  const handleDownload = async () => {
    if (!url.trim()) return;

    setError(null);
    setIsDownloading(true);
    setProgress(0);

    try {
      const result = await window.electronAPI.downloadYoutubeVideo(url.trim());
      if (result.success) {
        setUrl("");
        onVideoDownloaded(result.filePath);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message === "INVALID_YOUTUBE_URL") {
        setError(t("app.projects.youtubeInvalidUrl"));
      } else {
        setError(t("app.projects.youtubeDownloadError"));
      }
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const headingId = "youtube-import-heading";

  return (
    <div className={styles.youtubeSection}>
      <h4 id={headingId}>{t("app.projects.youtubeImport")}</h4>
      <div className={styles.inputRow}>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Enter") handleDownload();
          }}
          placeholder={t("app.projects.youtubeUrlPlaceholder")}
          className={styles.urlInput}
          disabled={isDownloading}
          aria-labelledby={headingId}
        />
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading || !url.trim()}
          className={styles.downloadBtn}
        >
          {isDownloading ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={faDownload} />
          )}
          {isDownloading ? t("app.projects.youtubeDownloading") : t("app.projects.youtubeDownload")}
        </button>
      </div>
      {isDownloading && (
        <div
          className={styles.progressSection}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>
      )}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
      <p className={styles.disclaimer}>{t("app.projects.youtubeDisclaimer")}</p>
    </div>
  );
};
