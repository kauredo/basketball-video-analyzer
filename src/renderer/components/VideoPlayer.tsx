import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faVolumeHigh,
  faLocationPin,
  faTrash,
  faFilm,
  faKeyboard,
  faAnglesLeft,
  faAnglesRight,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/VideoPlayer.module.css";

interface VideoPlayerProps {
  videoPath: string | null;
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  markInTime: number | null;
  markOutTime: number | null;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onClearMarks: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoPath,
  onTimeUpdate,
  onDurationChange,
  markInTime,
  markOutTime,
  onMarkIn,
  onMarkOut,
  onClearMarks,
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "KeyI":
          e.preventDefault();
          onMarkIn();
          break;
        case "KeyO":
          e.preventDefault();
          if (videoRef.current && isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
          onMarkOut();
          break;
        case "KeyC":
          e.preventDefault();
          onClearMarks();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Frame by frame backward
            stepFrame(-1);
          } else {
            skipTime(-5);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Frame by frame forward
            stepFrame(1);
          } else {
            skipTime(5);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [onMarkIn, onMarkOut, onClearMarks, isPlaying]);

  // Calculate frame duration (assuming 30fps)
  const frameDuration = 1 / 30;

  const stepFrame = (direction: number) => {
    if (videoRef.current) {
      // Pause the video if it's playing
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }

      // Move one frame forward or backward
      const newTime = Math.max(
        0,
        Math.min(duration, currentTime + direction * frameDuration)
      );
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      onDurationChange(dur);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const jumpToMark = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const getMarkedDuration = (): string => {
    if (markInTime !== null && markOutTime !== null) {
      return formatTime(markOutTime - markInTime);
    }
    return "--:--";
  };

  if (!videoPath) {
    return (
      <div className={styles.videoPlaceholder}>
        <div className={styles.placeholderContent}>
          <h3>
            <FontAwesomeIcon icon={faFilm} /> Load a Video to Start Cutting
            Clips
          </h3>
          <p>
            Select a basketball game video to begin creating clips for your team
          </p>
          <div className={styles.placeholderTips}>
            <h4>
              <FontAwesomeIcon icon={faKeyboard} /> Keyboard Shortcuts:
            </h4>
            <ul>
              <li>
                <kbd>Space</kbd> - Play/Pause
              </li>
              <li>
                <kbd>I</kbd> - Mark In Point
              </li>
              <li>
                <kbd>O</kbd> - Mark Out Point
              </li>
              <li>
                <kbd>C</kbd> - Clear Marks
              </li>
              <li>
                <kbd>←</kbd> / <kbd>→</kbd> - Skip 5 seconds
              </li>
              <li>
                <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> - Previous/Next
                Frame
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.videoPlayer}>
      <div
        className={styles.videoContainer}
        onMouseMove={() => {
          if (videoRef.current) {
            videoRef.current.style.cursor = "default";
            setTimeout(() => {
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.style.cursor = "none";
              }
            }, 2000);
          }
        }}
      >
        <video
          ref={videoRef}
          src={`file://${videoPath}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className={styles.videoElement}
          onClick={togglePlay}
        />
        <div className={styles.videoControls}>
          <div className={styles.progressContainer}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {markInTime !== null && markOutTime !== null && (
                <div
                  className={styles.markedRegion}
                  style={{
                    left: `${(markInTime / duration) * 100}%`,
                    width: `${((markOutTime - markInTime) / duration) * 100}%`,
                  }}
                />
              )}
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                className={styles.progressSlider}
              />
              {markInTime !== null && (
                <div
                  className={`${styles.markIndicator} ${styles.markIn}`}
                  style={{ left: `${(markInTime / duration) * 100}%` }}
                  onClick={() => jumpToMark(markInTime)}
                  title={`${t("app.video.markIn")}: ${formatTime(markInTime)}`}
                />
              )}
              {markOutTime !== null && (
                <div
                  className={`${styles.markIndicator} ${styles.markOut}`}
                  style={{ left: `${(markOutTime / duration) * 100}%` }}
                  onClick={() => jumpToMark(markOutTime)}
                  title={`${t("app.video.markOut")}: ${formatTime(
                    markOutTime
                  )}`}
                />
              )}
            </div>
          </div>

          <div className={styles.controlsSection}>
            <div className={styles.controlsRow}>
              <button onClick={togglePlay} className={styles.playButton}>
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>

              <button
                onClick={() => skipTime(-5)}
                className={styles.skipButton}
              >
                <FontAwesomeIcon icon={faBackwardStep} />
                <span className={styles.skipText}>5s</span>
              </button>

              <button
                onClick={() => stepFrame(-1)}
                className={styles.frameButton}
                title={t("app.video.previousFrame")}
              >
                <FontAwesomeIcon icon={faAnglesLeft} />
              </button>

              <button
                onClick={() => stepFrame(1)}
                className={styles.frameButton}
                title={t("app.video.nextFrame")}
              >
                <FontAwesomeIcon icon={faAnglesRight} />
              </button>

              <button onClick={() => skipTime(5)} className={styles.skipButton}>
                <span className={styles.skipText}>5s</span>
                <FontAwesomeIcon icon={faForwardStep} />
              </button>

              <div className={styles.timeDisplay}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className={styles.volumeControl}>
                <span>
                  <FontAwesomeIcon icon={faVolumeHigh} />
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={e => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (videoRef.current) {
                      videoRef.current.volume = newVolume;
                    }
                  }}
                  className={styles.volumeSlider}
                />
              </div>
            </div>

            <div className={styles.markControls}>
              <button
                onClick={onMarkIn}
                className={`${styles.markBtn} ${styles.markInBtn}`}
                disabled={!videoPath}
              >
                <FontAwesomeIcon icon={faLocationPin} /> Mark In (I)
              </button>

              <div className={styles.markInfo}>
                <div className={styles.markTimes}>
                  <span>
                    In: {markInTime !== null ? formatTime(markInTime) : "--:--"}
                  </span>
                  <span>
                    Out:{" "}
                    {markOutTime !== null ? formatTime(markOutTime) : "--:--"}
                  </span>
                  <span>Duration: {getMarkedDuration()}</span>
                </div>
              </div>

              <button
                onClick={onMarkOut}
                className={`${styles.markBtn} ${styles.markOutBtn}`}
                disabled={!videoPath}
              >
                <FontAwesomeIcon icon={faLocationPin} /> Mark Out (O)
              </button>

              <button
                onClick={onClearMarks}
                className={styles.clearMarksBtn}
                disabled={markInTime === null && markOutTime === null}
              >
                <FontAwesomeIcon icon={faTrash} /> Clear (C)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
