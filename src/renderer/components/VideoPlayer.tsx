import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import { useDismissableMenu } from "../hooks/useDismissableMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faVolumeHigh,
  faVolumeXmark,
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
  faClapperboard,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/VideoPlayer.module.css";
import { ContextualHint } from "./ContextualHint";
import { AnnotationReplayLayer } from "./AnnotationReplayLayer";
import { AnnotationTimingPopover } from "./AnnotationTimingControl";
import { formatVideoSrc } from "../utils/paths";
import { TelestrationLayer } from "./TelestrationLayer";
import {
  TelestrationShape,
  shapesToPngDataUrl,
  REPLAY_SECONDS_OPTIONS,
  DEFAULT_REPLAY_SECONDS,
} from "../utils/telestration";
import { useToastContext } from "../contexts/ToastContext";
import { loadPref, savePref, STORAGE_KEYS } from "../utils/storage";
import { Annotation, AnnotationTiming } from "../../types/global";
import { withCause } from "../utils/errors";

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
  const [showVolumeMenu, setShowVolumeMenu] = useState(false);
  const [showReplayMenu, setShowReplayMenu] = useState(false);

  const speedControlRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const replayControlRef = useRef<HTMLDivElement>(null);
  const [editingTimingId, setEditingTimingId] = useState<number | null>(null);
  const timingTriggerRef = useRef<HTMLButtonElement>(null);
  const closeTimingPopover = useCallback(() => setEditingTimingId(null), []);

  // Refs rather than class-name lookups: a CSS-module hash is a styling
  // identifier and nothing ties its shape to this behaviour.
  useDismissableMenu(
    showSpeedMenu || showVolumeMenu || showReplayMenu,
    useCallback(() => {
      setShowSpeedMenu(false);
      setShowVolumeMenu(false);
      setShowReplayMenu(false);
    }, []),
    [speedControlRef, volumeControlRef, replayControlRef],
  );
    const [keyBindings, setKeyBindings] = useState({
      markInKey: "z",
      markOutKey: "m",
    });
    const [videoError, setVideoError] = useState<string | null>(null);
    const [replayEnabled, setReplayEnabled] = useState(() =>
      loadPref(STORAGE_KEYS.ANNOTATION_REPLAY, true)
    );
    const [replaySeconds, setReplaySeconds] = useState(() => {
      const stored = loadPref(
        STORAGE_KEYS.ANNOTATION_REPLAY_SECONDS,
        DEFAULT_REPLAY_SECONDS
      );
      return REPLAY_SECONDS_OPTIONS.includes(stored)
        ? stored
        : DEFAULT_REPLAY_SECONDS;
    });

    const replayLabel = replayEnabled
      ? `${replaySeconds}s`
      : t("app.telestration.replayOff");

    const holdTimerRef = useRef<number | null>(null);
    const releaseHold = useCallback(() => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }, []);

    // Watch every frame rather than timeupdate, which fires only about four
    // times a second and would stop the video well past the drawing.
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !isPlaying || !replayEnabled || drawMode) return;
      const pausing = savedAnnotations.filter(a => a.pause_playback);
      if (pausing.length === 0) return;

      let prev = video.currentTime;
      let frame = 0;
      const tick = () => {
        const now = video.currentTime;
        const from = prev;
        prev = now;
        // A seek moves currentTime at once but its event arrives later, so a
        // skip can look like playback crossing a drawing. video.seeking is set
        // synchronously, and real playback never covers a second in a frame.
        const crossed = !video.seeking && now > from && now - from < 1;
        const hits = crossed
          ? pausing.filter(a => a.timestamp > from && a.timestamp <= now)
          : [];
        if (hits.length > 0) {
          video.pause();
          const seconds = Math.max(
            ...hits.map(a => a.display_seconds ?? replaySeconds)
          );
          holdTimerRef.current = window.setTimeout(() => {
            holdTimerRef.current = null;
            video.play().catch(() => {});
          }, seconds * 1000);
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [isPlaying, replayEnabled, drawMode, savedAnnotations, replaySeconds]);

    // Playing, seeking, drawing or turning replay off during a hold means the
    // coach has taken over, so the automatic resume is dropped.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.addEventListener("play", releaseHold);
      video.addEventListener("seeking", releaseHold);
      return () => {
        video.removeEventListener("play", releaseHold);
        video.removeEventListener("seeking", releaseHold);
        releaseHold();
      };
    }, [videoPath, videoError, drawMode, replayEnabled, releaseHold]);

    // null turns replay off and keeps the last duration for when it comes back.
    const selectReplay = (seconds: number | null) => {
      setReplayEnabled(seconds !== null);
      savePref(STORAGE_KEYS.ANNOTATION_REPLAY, seconds !== null);
      if (seconds !== null) {
        setReplaySeconds(seconds);
        savePref(STORAGE_KEYS.ANNOTATION_REPLAY_SECONDS, seconds);
      }
      setShowReplayMenu(false);
    };
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
        showError(withCause(t("app.telestration.saveStillError"), error));
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

    const handleSaveAnnotation = useCallback(async (
      timing: AnnotationTiming
    ) => {
      if (!projectId || !videoPath || shapes.length === 0) return;
      try {
        await window.electronAPI.createAnnotation({
          project_id: projectId,
          video_path: videoPath,
          timestamp: videoRef.current?.currentTime ?? 0,
          data: JSON.stringify(shapes),
          ...timing,
        });
        await loadAnnotations();
        showSuccess(t("app.telestration.savedAnnotation"));
      } catch (error) {
        console.error("Failed to save annotation:", error);
        showError(withCause(t("app.telestration.saveAnnotationError"), error));
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

    const updateAnnotationTiming = async (
      id: number,
      changes: AnnotationTiming
    ) => {
      try {
        await window.electronAPI.updateAnnotationTiming(id, changes);
        await loadAnnotations();
      } catch (error) {
        console.error("Failed to update annotation:", error);
        showError(withCause(t("app.telestration.saveAnnotationError"), error));
      }
    };

    const deleteAnnotationById = async (id: number) => {
      try {
        await window.electronAPI.deleteAnnotation(id);
        await loadAnnotations();
        showSuccess(t("app.telestration.deletedAnnotation"));
      } catch (error) {
        console.error("Failed to delete annotation:", error);
        showError(withCause(t("app.telestration.deleteAnnotationError"), error));
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
        } else if (
          key >= "1" &&
          key <= "9" &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          onQuickTag
        ) {
          // Unmodified digits only. Cmd/Ctrl+1 and +2 toggle the panels, and
          // without this guard they quick-tagged the clip on the way past.
          e.preventDefault();
          onQuickTag(parseInt(key, 10));
        }
      };

      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }, [onMarkIn, onMarkOut, onClearMarks, onQuickTag, isPlaying, keyBindings]);

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
      releaseHold();
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

    const editingAnnotation = savedAnnotations.find(
      a => a.id === editingTimingId
    );

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
          <AnnotationReplayLayer
            videoRef={videoRef}
            containerRef={containerRef}
            annotations={savedAnnotations}
            currentTime={currentTime}
            displaySeconds={replaySeconds}
            isPlaying={isPlaying}
            enabled={replayEnabled && !drawMode && !videoError}
          />
          <TelestrationLayer
            active={drawMode && !videoError}
            videoRef={videoRef}
            containerRef={containerRef}
            shapes={shapes}
            onShapesChange={setShapes}
            onSaveStill={handleSaveStill}
            onSaveAnnotation={projectId ? handleSaveAnnotation : undefined}
            defaultReplaySeconds={replaySeconds}
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
                        // Keys pressed on the buttons inside the marker are theirs.
                        if (e.target !== e.currentTarget) return;
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
                        ref={
                          editingTimingId === annotation.id
                            ? timingTriggerRef
                            : undefined
                        }
                        className={`${styles.annotationTiming} ${
                          annotation.display_seconds != null ||
                          annotation.pause_playback === true
                            ? styles.annotationTimingSet
                            : ""
                        }`}
                        onClick={e => {
                          e.stopPropagation();
                          setEditingTimingId(prev =>
                            prev === annotation.id ? null : annotation.id
                          );
                        }}
                        title={t("app.telestration.editTiming")}
                        aria-label={t("app.telestration.editTiming")}
                        aria-expanded={editingTimingId === annotation.id}
                        aria-controls={
                          editingTimingId === annotation.id
                            ? "annotation-timing-popover"
                            : undefined
                        }
                      >
                        <FontAwesomeIcon icon={faClock} />
                      </button>
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
                {duration > 0 && editingAnnotation && (
                  <AnnotationTimingPopover
                    id="annotation-timing-popover"
                    heading={`${t("app.telestration.savedView")}: ${formatTime(
                      editingAnnotation.timestamp
                    )}`}
                    positionPct={(editingAnnotation.timestamp / duration) * 100}
                    value={editingAnnotation}
                    onChange={changes =>
                      updateAnnotationTiming(editingAnnotation.id, changes)
                    }
                    defaultSeconds={replaySeconds}
                    triggerRef={timingTriggerRef}
                    onClose={closeTimingPopover}
                  />
                )}
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

                <div className={styles.volumeControl} ref={volumeControlRef}>
                  <button
                    type="button"
                    className={styles.speedButton}
                    onClick={() => {
                      setShowSpeedMenu(false);
                      setShowReplayMenu(false);
                      setShowVolumeMenu(!showVolumeMenu);
                    }}
                    title={t("app.video.volumeLabel")}
                    aria-label={t("app.video.volumeLabel")}
                    aria-expanded={showVolumeMenu}
                  >
                    <FontAwesomeIcon
                      icon={volume === 0 ? faVolumeXmark : faVolumeHigh}
                    />
                  </button>
                  {showVolumeMenu && (
                    <div className={styles.volumeMenu}>
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
                  )}
                </div>

                <div className={styles.speedControl} ref={speedControlRef}>
                  <button
                    type="button"
                    className={styles.speedButton}
                    onClick={() => {
                      setShowVolumeMenu(false);
                      setShowReplayMenu(false);
                      setShowSpeedMenu(!showSpeedMenu);
                    }}
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

                <div className={styles.speedControl} ref={replayControlRef}>
                  <button
                    type="button"
                    className={`${styles.speedButton} ${
                      replayEnabled ? styles.drawButtonActive : ""
                    }`}
                    onClick={() => {
                      setShowSpeedMenu(false);
                      setShowVolumeMenu(false);
                      setShowReplayMenu(!showReplayMenu);
                    }}
                    title={t("app.telestration.replayToggle")}
                    aria-label={`${t("app.telestration.replayToggle")}: ${replayLabel}`}
                    aria-expanded={showReplayMenu}
                  >
                    <FontAwesomeIcon icon={faClapperboard} />
                    <span className={styles.speedValue}>{replayLabel}</span>
                  </button>
                  {showReplayMenu && (
                    <div
                      className={`${styles.speedMenu} ${styles.replayMenu}`}
                      role="group"
                      aria-labelledby="replay-menu-heading"
                    >
                      <span
                        id="replay-menu-heading"
                        className={styles.replayMenuHeading}
                      >
                        {t("app.telestration.replayDuration")}
                      </span>
                      <button
                        type="button"
                        aria-pressed={!replayEnabled}
                        className={`${styles.speedOption} ${
                          !replayEnabled ? styles.activeSpeed : ""
                        }`}
                        onClick={() => selectReplay(null)}
                      >
                        {t("app.telestration.replayOff")}
                      </button>
                      {REPLAY_SECONDS_OPTIONS.map(seconds => {
                        const selected =
                          replayEnabled && replaySeconds === seconds;
                        return (
                          <button
                            key={seconds}
                            type="button"
                            aria-pressed={selected}
                            className={`${styles.speedOption} ${
                              selected ? styles.activeSpeed : ""
                            }`}
                            onClick={() => selectReplay(seconds)}
                          >
                            {seconds}s
                          </button>
                        );
                      })}
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

              {showFirstVideoHint && markInTime === null && (
                <ContextualHint
                  hintId="first-video"
                  message={t("app.hints.markKeys", {
                    markIn: keyBindings.markInKey.toUpperCase(),
                    markOut: keyBindings.markOutKey.toUpperCase(),
                  })}
                />
              )}

              {markInTime !== null && markOutTime === null && (
                <ContextualHint
                  hintId="first-mark-out"
                  message={t("app.hints.markOutNext", {
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
