import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/PresentMode.module.css";
import { Clip, Category } from "../../types/global";
import { formatVideoSrc } from "../utils/paths";

interface PresentModeProps {
  clips: Clip[];
  categories: Category[];
  onClose: () => void;
}

export const PresentMode: React.FC<PresentModeProps> = ({
  clips,
  categories,
  onClose,
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const currentClip = clips[currentIndex];

  const getClipCategories = useCallback(
    (clip: Clip): Category[] => {
      try {
        const categoryIds = JSON.parse(clip.categories);
        return categories.filter(cat => categoryIds.includes(cat.id));
      } catch {
        return [];
      }
    },
    [categories],
  );

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < clips.length - 1 ? prev + 1 : prev));
  }, [clips.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {
      // Autoplay can be interrupted; ignore
    });
  }, [currentIndex]);

  const handleEnded = useCallback(() => {
    if (!autoAdvance) return;
    if (currentIndex < clips.length - 1) {
      goToNext();
    } else {
      setIsPlaying(false);
    }
  }, [autoAdvance, currentIndex, clips.length, goToNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goToPrev();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, togglePlay, goToNext, goToPrev]);

  if (!currentClip) {
    return null;
  }

  return (
    <div
      className={styles.presentMode}
      role="dialog"
      aria-modal="true"
      aria-labelledby="present-clip-title"
    >
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label={t("app.buttons.close")}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>

      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          className={styles.video}
          src={formatVideoSrc(currentClip.output_path)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          autoPlay
        />
      </div>

      <div className={styles.overlay}>
        <div className={styles.clipInfo}>
          <span className={styles.counter}>
            {t("app.present.clipCounter", {
              current: currentIndex + 1,
              total: clips.length,
            })}
          </span>
          <h2 id="present-clip-title" className={styles.clipTitle}>{currentClip.title}</h2>
          <div className={styles.clipCategories}>
            {getClipCategories(currentClip).map(category => (
              <span
                key={category.id}
                className={styles.categoryTag}
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={goToPrev}
            disabled={currentIndex === 0}
            title={t("app.present.previous")}
            aria-label={t("app.present.previous")}
          >
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={togglePlay}
            title={isPlaying ? t("app.buttons.pause") : t("app.buttons.play")}
            aria-label={isPlaying ? t("app.buttons.pause") : t("app.buttons.play")}
          >
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={goToNext}
            disabled={currentIndex === clips.length - 1}
            title={t("app.present.next")}
            aria-label={t("app.present.next")}
          >
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${styles.toggleBtn} ${
              autoAdvance ? styles.toggleActive : ""
            }`}
            onClick={() => setAutoAdvance(prev => !prev)}
            title={t("app.present.autoAdvance")}
            aria-label={t("app.present.autoAdvance")}
            aria-pressed={autoAdvance}
          >
            <FontAwesomeIcon icon={faRepeat} />
          </button>
        </div>
      </div>
    </div>
  );
};
