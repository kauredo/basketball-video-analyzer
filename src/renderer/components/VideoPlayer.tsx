import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
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
  faGaugeHigh,
  faPen,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/VideoPlayer.module.css";
import { ContextualHint } from "./ContextualHint";
import { formatVideoSrc } from "../utils/paths";
import { TelestrationLayer } from "./TelestrationLayer";
import { TelestrationShape, shapesToPngDataUrl } from "../utils/telestration";
import { useToastContext } from "../contexts/ToastContext";
import { Annotation } from "../../types/global";

interface VideoPlayerProps {
  videoPath: string | null;
  projectId?: number;
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  markInTime: number | null;
  markOutTime: number | null;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onClearMarks: () => void;
  onQuickTag?: (keyNumber: number) => void;
}

interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getOverlay: () => string | null;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      videoPath,
      projectId,
      onTimeUpdate,
      onDurationChange,
      markInTime,
      markOutTime,
      onMarkIn,
      onMarkOut,
      onClearMarks,
      onQuickTag,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { showSuccess, showError } = useToastContext();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeSearchInputRef = useRef<HTMLInputElement>(null);
    const [drawMode, setDrawMode] = useState(false);
    const [shapes, setShapes] = useState<TelestrationShape[]>([]);
    const [savingStill, setSavingStill] = useState(false);
    const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);
    // Mirror shapes into a ref so getOverlay() always reads the latest drawing
    // regardless of how the imperative handle is memoized.
    const shapesRef = useRef(shapes);
    shapesRef.current = shapes;
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [keyBindings, setKeyBindings] = useState({
      markInKey: "z",
      markOutKey: "m",
    });
    const [videoError, setVideoError] = useState<string | null>(null);
    const [timeSearchValue, setTimeSearchValue] = useState("");
    const [timeSearchError, setTimeSearchError] = useState<string | null>(null);
    const [showFirstVideoHint, setShowFirstVideoHint] = useState(false);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
      // Current drawing as a native-resolution transparent PNG data URL, or
      // null if nothing is drawn. Used to burn annotations into exported clips.
      getOverlay: (): string | null => {
        const video = videoRef.current;
        if (!video) return null;
        return shapesToPngDataUrl(
          shapesRef.current,
          video.videoWidth,
          video.videoHeight
        );
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

    const toggleDrawMode = () => {
      setDrawMode(prev => {
        const next = !prev;
        if (next) pauseVideo();
        return next;
      });
    };

    const handleSaveStill = useCallback(async () => {
      const video = videoRef.current;
      if (!video || !videoPath) return;
      const overlay = shapesToPngDataUrl(
        shapes,
        video.videoWidth,
        video.videoHeight
      );
      if (!overlay) return;
      setSavingStill(true);
      try {
        const result = await window.electronAPI.exportAnnotatedFrame({
          inputPath: videoPath,
          time: video.currentTime,
          overlayImage: overlay,
        });
        if (result?.filePath) {
          showSuccess(t("app.telestration.savedStill"));
        }
      } catch (error) {
        console.error("Error saving annotated still:", error);
        showError(t("app.telestration.saveStillError"));
      } finally {
        setSavingStill(false);
      }
    }, [shapes, videoPath, showSuccess, showError, t]);

    const loadAnnotations = useCallback(async () => {
      if (!projectId || !videoPath) {
        setSavedAnnotations([]);
        return;
      }
      try {
        setSavedAnnotations(
          await window.electronAPI.getAnnotations(projectId, videoPath)
        );
      } catch (error) {
        console.error("Failed to load annotations:", error);
      }
    }, [projectId, videoPath]);

    useEffect(() => {
      loadAnnotations();
    }, [loadAnnotations]);

    const handleSaveAnnotation = useCallback(async () => {
      if (!projectId || !videoPath || shapes.length === 0) return;
      try {
        await window.electronAPI.createAnnotation({
          project_id: projectId,
          video_path: videoPath,
          timestamp: videoRef.current?.currentTime ?? 0,
          data: JSON.stringify(shapes),
        });
        await loadAnnotations();
        showSuccess(t("app.telestration.savedAnnotation"));
      } catch (error) {
        console.error("Failed to save annotation:", error);
        showError(t("app.telestration.saveAnnotationError"));
      }
    }, [projectId, videoPath, shapes, loadAnnotations, showSuccess, showError, t]);

    const openAnnotation = (annotation: Annotation) => {
      try {
        const parsed = JSON.parse(annotation.data);
        if (!Array.isArray(parsed)) return;
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = annotation.timestamp;
          setCurrentTime(annotation.timestamp);
          setIsPlaying(false);
        }
        setShapes(parsed as TelestrationShape[]);
        setDrawMode(true);
      } catch (error) {
        console.error("Failed to open annotation:", error);
      }
    };

    const deleteAnnotationById = async (id: number) => {
      try {
        await window.electronAPI.deleteAnnotation(id);
        await loadAnnotations();
        showSuccess(t("app.telestration.deletedAnnotation"));
      } catch (error) {
        console.error("Failed to delete annotation:", error);
        showError(t("app.telestration.deleteAnnotationError"));
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

        // While drawing, the telestration layer owns the keyboard (Escape exits).
        if (drawMode) {
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
        } else if (key >= "1" && key <= "9" && onQuickTag) {
          e.preventDefault();
          onQuickTag(parseInt(key, 10));
        }
      };

      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }, [onMarkIn, onMarkOut, onClearMarks, onQuickTag, isPlaying, keyBindings, drawMode]);

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
        // Show first-video hint 2s after video loads
        setTimeout(() => setShowFirstVideoHint(true), 2000);
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

      let errorMessage = t("app.video.loadingError");
      if (error) {
        switch (error.code) {
          case 1:
            errorMessage = t("app.video.errorVideoAborted");
            break;
          case 2:
            errorMessage = t("app.video.errorVideoNetwork");
            break;
          case 3:
            errorMessage = t("app.video.errorVideoDecoding");
            break;
          case 4:
            errorMessage = t("app.video.errorVideoFormat");
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
              <FontAwesomeIcon icon={faFilm} /> {t("app.video.loadVideoTitle")}
            </h3>
            <p>
              {t("app.video.loadVideoDescription")}
            </p>
            <div className={styles.placeholderTips}>
              <h4>
                <FontAwesomeIcon icon={faKeyboard} /> {t("app.video.keyboardShortcuts")}:
              </h4>
              <ul>
                <li>
                  <kbd>Space</kbd> - {t("app.video.playPause")}
                </li>
                <li>
                  <kbd>{keyBindings.markInKey.toUpperCase()}</kbd> - {t("app.video.markInPoint")}
                </li>
                <li>
                  <kbd>{keyBindings.markOutKey.toUpperCase()}</kbd> - {t("app.video.markOutPoint")}
                </li>
                <li>
                  <kbd>Escape</kbd> - {t("app.buttons.clearMarks")}
                </li>
                <li>
                  <kbd>←</kbd> / <kbd>→</kbd> - {t("app.video.previousNextFrame")}
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
          ref={containerRef}
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
                <p>{t("app.video.pathLabel")} {videoPath}</p>
                <p>
                  {t("app.video.checkVideoFormat")}
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
          <TelestrationLayer
            active={drawMode && !videoError}
            videoRef={videoRef}
            containerRef={containerRef}
            shapes={shapes}
            onShapesChange={setShapes}
            onSaveStill={handleSaveStill}
            onSaveAnnotation={projectId ? handleSaveAnnotation : undefined}
            onClose={() => setDrawMode(false)}
            saving={savingStill}
          />
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
                  aria-label={t("app.video.playPause")}
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
                {duration > 0 &&
                  savedAnnotations.map(annotation => (
                    <div
                      key={annotation.id}
                      className={styles.annotationMarker}
                      style={{
                        left: `${(annotation.timestamp / duration) * 100}%`,
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openAnnotation(annotation)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openAnnotation(annotation);
                        }
                      }}
                      title={`${t("app.telestration.savedView")}: ${formatTime(
                        annotation.timestamp
                      )}`}
                    >
                      <FontAwesomeIcon icon={faPen} />
                      <button
                        type="button"
                        className={styles.annotationDelete}
                        onClick={e => {
                          e.stopPropagation();
                          deleteAnnotationById(annotation.id);
                        }}
                        title={t("app.telestration.deleteView")}
                        aria-label={t("app.telestration.deleteView")}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div className={styles.controlsSection}>
              <div className={styles.controlsRow}>
                <button
                  type="button"
                  onClick={togglePlay}
                  className={styles.playButton}
                  aria-label={isPlaying ? t("app.buttons.pause") : t("app.buttons.play")}
                >
                  <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
                </button>

                {/* 1 minute backward */}
                <button
                  type="button"
                  onClick={() => skipTime(-60)}
                  className={`${styles.skipButton} ${styles.skipButtonLarge}`}
                  title={t("app.video.skip1minBack")}
                >
                  <FontAwesomeIcon icon={faBackwardStep} />
                  <span className={styles.skipText}>1m</span>
                </button>

                {/* 30 seconds backward */}
                <button
                  type="button"
                  onClick={() => skipTime(-30)}
                  className={`${styles.skipButton} ${styles.skipButtonMedium}`}
                  title={t("app.video.skip30sBack")}
                >
                  <FontAwesomeIcon icon={faBackwardStep} />
                  <span className={styles.skipText}>30s</span>
                </button>

                {/* 5 seconds backward */}
                <button
                  type="button"
                  onClick={() => skipTime(-5)}
                  className={styles.skipButton}
                  title={t("app.video.skip5sBack")}
                >
                  <FontAwesomeIcon icon={faBackwardStep} />
                  <span className={styles.skipText}>5s</span>
                </button>

                <button
                  type="button"
                  onClick={() => stepFrame(-1)}
                  className={styles.frameButton}
                  title={t("app.video.previousFrame")}
                  aria-label={t("app.video.previousFrame")}
                >
                  <FontAwesomeIcon icon={faAnglesLeft} />
                </button>

                <button
                  type="button"
                  onClick={() => stepFrame(1)}
                  className={styles.frameButton}
                  title={t("app.video.nextFrame")}
                  aria-label={t("app.video.nextFrame")}
                >
                  <FontAwesomeIcon icon={faAnglesRight} />
                </button>

                {/* 5 seconds forward */}
                <button
                  type="button"
                  onClick={() => skipTime(5)}
                  className={styles.skipButton}
                  title={t("app.video.skip5sForward")}
                >
                  <span className={styles.skipText}>5s</span>
                  <FontAwesomeIcon icon={faForwardStep} />
                </button>

                {/* 30 seconds forward */}
                <button
                  type="button"
                  onClick={() => skipTime(30)}
                  className={`${styles.skipButton} ${styles.skipButtonMedium}`}
                  title={t("app.video.skip30sForward")}
                >
                  <span className={styles.skipText}>30s</span>
                  <FontAwesomeIcon icon={faForwardStep} />
                </button>

                {/* 1 minute forward */}
                <button
                  type="button"
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
                      type="button"
                      onClick={handleTimeSearch}
                      className={styles.timeSearchButton}
                      disabled={!timeSearchValue.trim()}
                      title={t("app.video.timeSearch.jumpToTime")}
                      aria-label={t("app.video.timeSearch.jumpToTime")}
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
                    aria-label={t("app.video.volumeLabel")}
                  />
                </div>

                <div className={styles.speedControl}>
                  <button
                    type="button"
                    className={styles.speedButton}
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    title={t("app.video.playbackSpeed")}
                  >
                    <FontAwesomeIcon icon={faGaugeHigh} />
                    <span className={styles.speedValue}>{playbackRate}x</span>
                  </button>
                  {showSpeedMenu && (
                    <div className={styles.speedMenu}>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                        <button
                          key={rate}
                          type="button"
                          className={`${styles.speedOption} ${
                            playbackRate === rate ? styles.activeSpeed : ""
                          }`}
                          onClick={() => {
                            setPlaybackRate(rate);
                            if (videoRef.current) {
                              videoRef.current.playbackRate = rate;
                            }
                            setShowSpeedMenu(false);
                          }}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={`${styles.speedButton} ${
                    drawMode ? styles.drawButtonActive : ""
                  }`}
                  onClick={toggleDrawMode}
                  title={t("app.telestration.draw")}
                  aria-label={t("app.telestration.draw")}
                  aria-pressed={drawMode}
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
              </div>

              {showFirstVideoHint && (
                <ContextualHint
                  hintId="first-video"
                  message={t("app.hints.markKeys", {
                    markIn: keyBindings.markInKey.toUpperCase(),
                    markOut: keyBindings.markOutKey.toUpperCase(),
                  })}
                />
              )}

              <div className={styles.markControls}>
                <button
                  type="button"
                  onClick={onMarkIn}
                  className={`${styles.markBtn} ${styles.markInBtn}`}
                  disabled={!videoPath || !!videoError}
                >
                  <FontAwesomeIcon icon={faLocationPin} /> {t("app.video.markIn")} (
                  {keyBindings.markInKey.toUpperCase()})
                </button>

                <div className={styles.markInfo}>
                  <div className={styles.markTimes}>
                    <span>
                      {t("app.video.markIn")}:{" "}
                      {markInTime !== null ? formatTime(markInTime) : "--:--"}
                    </span>
                    <span>
                      {t("app.video.markOut")}:{" "}
                      {markOutTime !== null ? formatTime(markOutTime) : "--:--"}
                    </span>
                    <span>{t("app.clips.creator.duration")}: {getMarkedDuration()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    pauseVideo();
                    onMarkOut();
                  }}
                  className={`${styles.markBtn} ${styles.markOutBtn}`}
                  disabled={!videoPath || !!videoError}
                >
                  <FontAwesomeIcon icon={faLocationPin} /> {t("app.video.markOut")} (
                  {keyBindings.markOutKey.toUpperCase()})
                </button>

                <button
                  type="button"
                  onClick={onClearMarks}
                  className={`${styles.markBtn} ${styles.clearMarksBtn}`}
                  disabled={markInTime === null && markOutTime === null}
                >
                  <FontAwesomeIcon icon={faTrash} /> {t("app.buttons.clearMarks")} (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
