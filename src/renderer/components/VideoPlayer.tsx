import React, { useRef, useState, useEffect } from "react";
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
} from "@fortawesome/free-solid-svg-icons";

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
          onMarkOut();
          break;
        case "KeyC":
          e.preventDefault();
          onClearMarks();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipTime(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          skipTime(5);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [onMarkIn, onMarkOut, onClearMarks]);

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
      <div className="video-placeholder">
        <div className="placeholder-content">
          <h3>
            <FontAwesomeIcon icon={faFilm} /> Load a Video to Start Cutting
            Clips
          </h3>
          <p>
            Select a basketball game video to begin creating clips for your team
          </p>
          <div className="placeholder-tips">
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
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
      {/* Video Element */}
      <div className="video-container">
        <video
          ref={videoRef}
          src={`file://${videoPath}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="video-element"
        />

        {/* Mark Indicators Overlay */}
        {(markInTime !== null || markOutTime !== null) && (
          <div className="marks-overlay">
            {markInTime !== null && (
              <div
                className="mark-indicator mark-in"
                style={{ left: `${(markInTime / duration) * 100}%` }}
                onClick={() => jumpToMark(markInTime)}
                title={`Mark In: ${formatTime(markInTime)}`}
              >
                IN
              </div>
            )}
            {markOutTime !== null && (
              <div
                className="mark-indicator mark-out"
                style={{ left: `${(markOutTime / duration) * 100}%` }}
                onClick={() => jumpToMark(markOutTime)}
                title={`Mark Out: ${formatTime(markOutTime)}`}
              >
                OUT
              </div>
            )}
            {markInTime !== null && markOutTime !== null && (
              <div
                className="marked-region"
                style={{
                  left: `${(markInTime / duration) * 100}%`,
                  width: `${((markOutTime - markInTime) / duration) * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Mark Controls - Prominent */}
      <div className="mark-controls">
        <button
          onClick={onMarkIn}
          className="mark-btn mark-in-btn"
          disabled={!videoPath}
        >
          <FontAwesomeIcon icon={faLocationPin} /> Mark In (I)
        </button>

        <div className="mark-info">
          <div className="mark-times">
            <span>
              In: {markInTime !== null ? formatTime(markInTime) : "--:--"}
            </span>
            <span>
              Out: {markOutTime !== null ? formatTime(markOutTime) : "--:--"}
            </span>
            <span>Duration: {getMarkedDuration()}</span>
          </div>
        </div>

        <button
          onClick={onMarkOut}
          className="mark-btn mark-out-btn"
          disabled={!videoPath}
        >
          <FontAwesomeIcon icon={faLocationPin} /> Mark Out (O)
        </button>

        <button
          onClick={onClearMarks}
          className="clear-marks-btn"
          disabled={markInTime === null && markOutTime === null}
        >
          <FontAwesomeIcon icon={faTrash} /> Clear (C)
        </button>
      </div>

      {/* Video Controls */}
      <div className="video-controls">
        <div className="controls-row">
          <button onClick={togglePlay} className="play-btn">
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
          </button>

          <button onClick={() => skipTime(-5)} className="skip-btn">
            <FontAwesomeIcon icon={faBackwardStep} /> 5s
          </button>

          <button onClick={() => skipTime(5)} className="skip-btn">
            5s <FontAwesomeIcon icon={faForwardStep} />
          </button>

          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="volume-control">
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
              className="volume-slider"
            />
          </div>
        </div>

        {/* Progress Bar with Marks */}
        <div className="progress-container">
          <div className="progress-track">
            {/* Marked region background */}
            {markInTime !== null && markOutTime !== null && (
              <div
                className="marked-region-track"
                style={{
                  left: `${(markInTime / duration) * 100}%`,
                  width: `${((markOutTime - markInTime) / duration) * 100}%`,
                }}
              />
            )}

            {/* Progress slider */}
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="progress-slider"
            />

            {/* Mark indicators */}
            {markInTime !== null && (
              <div
                className="mark-tick mark-in-tick"
                style={{ left: `${(markInTime / duration) * 100}%` }}
              />
            )}
            {markOutTime !== null && (
              <div
                className="mark-tick mark-out-tick"
                style={{ left: `${(markOutTime / duration) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
