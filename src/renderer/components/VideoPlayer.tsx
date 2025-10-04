import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
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
  faSearch,
  faClock,
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

interface VideoPlayerRef {
  seekTo: (time: number) => void;
}

// Helper function to format file paths for video src
const formatVideoSrc = (path: string): string => {
  // Check if it's already a file URL
  if (path.startsWith("file://")) {
    return path;
  }

  // For Windows paths (detected by drive letter pattern like C:\ or C:/)
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    // Convert backslashes to forward slashes for URL format
    const normalizedPath = path.replace(/\\/g, "/");
    // Windows file URLs need three slashes
    return `file:///${normalizedPath}`;
  }

  // For Unix-like paths (starting with /)
  if (path.startsWith("/")) {
    return `file://${path}`;
  }

  // Fallback - just prepend file://
  return `file://${path}`;
};

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      videoPath,
      onTimeUpdate,
      onDurationChange,
      markInTime,
      markOutTime,
      onMarkIn,
      onMarkOut,
      onClearMarks,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const timeSearchInputRef = useRef<HTMLInputElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [keyBindings, setKeyBindings] = useState({
      markInKey: "z",
      markOutKey: "m",
    });
    const [videoError, setVideoError] = useState<string | null>(null);
    const [timeSearchValue, setTimeSearchValue] = useState("");
    const [timeSearchError, setTimeSearchError] = useState<string | null>(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
    }));

    useEffect(() => {
      const loadKeyBindings = async () => {
        try {
          const bindings = await window.electronAPI.getKeyBindings();
          setKeyBindings(bindings);
        } catch (error) {
          console.error("Failed to load key bindings:", error);
        }
      };

      const handleKeyBindingsChanged = (newBindings: {
        markInKey: string;
        markOutKey: string;
      }) => {
        setKeyBindings(newBindings);
      };

      loadKeyBindings();
      window.electronAPI.onKeyBindingsChanged(handleKeyBindingsChanged);

      return () => {
        window.electronAPI.removeAllListeners("keyBindingsChanged");
      };
    }, []);

    const pauseVideo = () => {
      if (videoRef.current && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Ignore keyboard shortcuts when user is typing in an input field
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLButtonElement ||
          (e.target as HTMLElement)?.isContentEditable
        ) {
          return;
        }

        const key = e.key.toLowerCase();

        if (key === keyBindings.markInKey) {
          e.preventDefault();
          onMarkIn();
        } else if (key === keyBindings.markOutKey) {
          e.preventDefault();
          pauseVideo();
          onMarkOut();
        } else if (key === " ") {
          e.preventDefault();
          togglePlay();
        } else if (key === "escape") {
          e.preventDefault();
          onClearMarks();
        } else if (key === "arrowright") {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Right Arrow = 1 minute forward
            skipTime(60);
          } else if (e.altKey) {
            // Alt + Right Arrow = 30 seconds forward
            skipTime(30);
          } else if (e.shiftKey) {
            stepFrame(1);
          } else {
            skipTime(5);
          }
        } else if (key === "arrowleft") {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Left Arrow = 1 minute backward
            skipTime(-60);
          } else if (e.altKey) {
            // Alt + Left Arrow = 30 seconds backward
            skipTime(-30);
          } else if (e.shiftKey) {
            stepFrame(-1);
          } else {
            skipTime(-5);
          }
        }
      };

      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }, [onMarkIn, onMarkOut, onClearMarks, isPlaying, keyBindings]);

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
        setVideoError(null);
      }
    };

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      const error = video.error;

      console.error("Video error:", error);
      console.error("Video path:", videoPath);
      console.error(
        "Formatted src:",
        videoPath ? formatVideoSrc(videoPath) : null
      );

      let errorMessage = "Error loading video file";
      if (error) {
        switch (error.code) {
          case 1:
            errorMessage = "Video loading aborted";
            break;
          case 2:
            errorMessage = "Network error while loading video";
            break;
          case 3:
            errorMessage = "Video decoding error - format may not be supported";
            break;
          case 4:
            errorMessage = "Video format not supported";
            break;
        }
      }
      setVideoError(errorMessage);
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
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const parseTime = (timeString: string): number | null => {
      if (!timeString.trim()) return null;

      // Remove extra spaces and normalize
      const cleaned = timeString.trim();

      // Match patterns: HH:MM:SS, MM:SS, or just SS
      const timeRegex = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})$|^(\d{1,4})$/;
      const match = cleaned.match(timeRegex);

      if (!match) return null;

      let hours = 0,
        minutes = 0,
        seconds = 0;

      if (match[4]) {
        // Just seconds (e.g., "90" = 1:30)
        seconds = parseInt(match[4], 10);
      } else {
        // HH:MM:SS or MM:SS format
        if (match[1] !== undefined) {
          // HH:MM:SS format
          hours = parseInt(match[1], 10);
          minutes = parseInt(match[2], 10);
          seconds = parseInt(match[3], 10);
        } else {
          // MM:SS format
          minutes = parseInt(match[2], 10);
          seconds = parseInt(match[3], 10);
        }
      }

      // Validate ranges
      if (seconds >= 60 || minutes >= 60 || hours >= 24) {
        return null;
      }

      return hours * 3600 + minutes * 60 + seconds;
    };

    const handleTimeSearch = () => {
      setTimeSearchError(null);

      if (!timeSearchValue.trim()) {
        setTimeSearchError(t("app.video.timeSearch.enterTime"));
        return;
      }

      const targetTime = parseTime(timeSearchValue);

      if (targetTime === null) {
        setTimeSearchError(t("app.video.timeSearch.invalidFormat"));
        return;
      }

      if (targetTime > duration) {
        setTimeSearchError(t("app.video.timeSearch.timeExceedsVideo"));
        return;
      }

      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
        setTimeSearchValue(""); // Clear after successful jump
        setTimeSearchError(null);
      }
    };

    const handleTimeSearchKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTimeSearch();
      }
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
              Select a basketball game video to begin creating clips for your
              team
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
                  <kbd>{keyBindings.markInKey.toUpperCase()}</kbd> - Mark In
                  Point
                </li>
                <li>
                  <kbd>{keyBindings.markOutKey.toUpperCase()}</kbd> - Mark Out
                  Point
                </li>
                <li>
                  <kbd>Escape</kbd> - Clear Marks
                </li>
                <li>
                  <kbd>←</kbd> / <kbd>→</kbd> - Previous/Next Frame
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
          {videoError ? (
            <div className={styles.videoPlaceholder}>
              <div className={styles.placeholderContent}>
                <h3>
                  <FontAwesomeIcon icon={faFilm} /> {videoError}
                </h3>
                <p>Path: {videoPath}</p>
                <p>
                  Please check if the video file exists and is in a supported
                  format (MP4, MOV, AVI, MKV, WebM)
                </p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={formatVideoSrc(videoPath)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className={styles.videoElement}
              onClick={togglePlay}
            />
          )}
          <div className={styles.videoControls}>
            <div className={styles.progressContainer}>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${
                      duration > 0 ? (currentTime / duration) * 100 : 0
                    }%`,
                  }}
                />
                {markInTime !== null &&
                  markOutTime !== null &&
                  duration > 0 && (
                    <div
                      className={styles.markedRegion}
                      style={{
                        left: `${(markInTime / duration) * 100}%`,
                        width: `${
                          ((markOutTime - markInTime) / duration) * 100
                        }%`,
                      }}
                    />
                  )}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className={styles.progressSlider}
                />
                {markInTime !== null && duration > 0 && (
                  <div
                    className={`${styles.markIndicator} ${styles.markIn}`}
                    style={{ left: `${(markInTime / duration) * 100}%` }}
                    onClick={() => jumpToMark(markInTime)}
                    title={`${t("app.video.markIn")}: ${formatTime(
                      markInTime
                    )}`}
                  />
                )}
                {markOutTime !== null && duration > 0 && (
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

                {/* 1 minute backward */}
                <button
                  onClick={() => skipTime(-60)}
                  className={`${styles.skipButton} ${styles.skipButtonLarge}`}
                  title={t("app.video.skip1minBack")}
                >
                  <FontAwesomeIcon icon={faBackwardStep} />
                  <span className={styles.skipText}>1m</span>
                </button>

                {/* 30 seconds backward */}
                <button
                  onClick={() => skipTime(-30)}
                  className={`${styles.skipButton} ${styles.skipButtonMedium}`}
                  title={t("app.video.skip30sBack")}
                >
                  <FontAwesomeIcon icon={faBackwardStep} />
                  <span className={styles.skipText}>30s</span>
                </button>

                {/* 5 seconds backward */}
                <button
                  onClick={() => skipTime(-5)}
                  className={styles.skipButton}
                  title={t("app.video.skip5sBack")}
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

                {/* 5 seconds forward */}
                <button
                  onClick={() => skipTime(5)}
                  className={styles.skipButton}
                  title={t("app.video.skip5sForward")}
                >
                  <span className={styles.skipText}>5s</span>
                  <FontAwesomeIcon icon={faForwardStep} />
                </button>

                {/* 30 seconds forward */}
                <button
                  onClick={() => skipTime(30)}
                  className={`${styles.skipButton} ${styles.skipButtonMedium}`}
                  title={t("app.video.skip30sForward")}
                >
                  <span className={styles.skipText}>30s</span>
                  <FontAwesomeIcon icon={faForwardStep} />
                </button>

                {/* 1 minute forward */}
                <button
                  onClick={() => skipTime(60)}
                  className={`${styles.skipButton} ${styles.skipButtonLarge}`}
                  title={t("app.video.skip1minForward")}
                >
                  <span className={styles.skipText}>1m</span>
                  <FontAwesomeIcon icon={faForwardStep} />
                </button>

                <div className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                <div className={styles.timeSearchContainer}>
                  <div className={styles.timeSearchInput}>
                    <FontAwesomeIcon
                      icon={faClock}
                      className={styles.timeSearchIcon}
                    />
                    <input
                      ref={timeSearchInputRef}
                      type="text"
                      value={timeSearchValue}
                      onChange={e => {
                        e.stopPropagation();
                        setTimeSearchValue(e.target.value);
                      }}
                      onKeyPress={handleTimeSearchKeyPress}
                      onKeyDown={e => {
                        e.stopPropagation();
                      }}
                      placeholder={t("app.video.timeSearch.placeholder")}
                      className={`${styles.timeSearchField} ${
                        timeSearchError ? styles.timeSearchError : ""
                      }`}
                      title={t("app.video.timeSearch.tooltip")}
                    />
                    <button
                      onClick={handleTimeSearch}
                      className={styles.timeSearchButton}
                      disabled={!timeSearchValue.trim()}
                      title={t("app.video.timeSearch.jumpToTime")}
                    >
                      <FontAwesomeIcon icon={faSearch} />
                    </button>
                  </div>
                  {timeSearchError && (
                    <div className={styles.timeSearchErrorMessage}>
                      {timeSearchError}
                    </div>
                  )}
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
                  disabled={!videoPath || !!videoError}
                >
                  <FontAwesomeIcon icon={faLocationPin} /> Mark In (
                  {keyBindings.markInKey.toUpperCase()})
                </button>

                <div className={styles.markInfo}>
                  <div className={styles.markTimes}>
                    <span>
                      In:{" "}
                      {markInTime !== null ? formatTime(markInTime) : "--:--"}
                    </span>
                    <span>
                      Out:{" "}
                      {markOutTime !== null ? formatTime(markOutTime) : "--:--"}
                    </span>
                    <span>Duration: {getMarkedDuration()}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    pauseVideo();
                    onMarkOut();
                  }}
                  className={`${styles.markBtn} ${styles.markOutBtn}`}
                  disabled={!videoPath || !!videoError}
                >
                  <FontAwesomeIcon icon={faLocationPin} /> Mark Out (
                  {keyBindings.markOutKey.toUpperCase()})
                </button>

                <button
                  onClick={onClearMarks}
                  className={styles.clearMarksBtn}
                  disabled={markInTime === null && markOutTime === null}
                >
                  <FontAwesomeIcon icon={faTrash} /> Clear (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
