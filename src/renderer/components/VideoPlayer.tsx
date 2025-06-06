import React, { useRef, useState, useEffect, useCallback } from "react";

interface VideoPlayerProps {
  videoPath: string | null;
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  seekToTime?: number;
  playbackRate?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoPath,
  onTimeUpdate,
  onDurationChange,
  seekToTime,
  playbackRate = 1,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (seekToTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToTime;
    }
  }, [seekToTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      onDurationChange(dur);
    }
  }, [onDurationChange]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
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

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target === document.body) {
        switch (e.code) {
          case "Space":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
            e.preventDefault();
            skipTime(-5);
            break;
          case "ArrowRight":
            e.preventDefault();
            skipTime(5);
            break;
          case "ArrowUp":
            e.preventDefault();
            setVolume(Math.min(1, volume + 0.1));
            break;
          case "ArrowDown":
            e.preventDefault();
            setVolume(Math.max(0, volume - 0.1));
            break;
          case "KeyF":
            e.preventDefault();
            toggleFullscreen();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [volume, isPlaying]);

  if (!videoPath) {
    return (
      <div className="video-placeholder">
        <div className="placeholder-content">
          <h3>No Video Selected</h3>
          <p>Click "Select Video File" to load a basketball game video</p>
          <div className="placeholder-tips">
            <h4>Keyboard Shortcuts:</h4>
            <ul>
              <li>
                <kbd>Space</kbd> - Play/Pause
              </li>
              <li>
                <kbd>←</kbd> / <kbd>→</kbd> - Skip 5 seconds
              </li>
              <li>
                <kbd>↑</kbd> / <kbd>↓</kbd> - Volume
              </li>
              <li>
                <kbd>F</kbd> - Fullscreen
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
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

        <div className="video-overlay">
          <button
            className="play-overlay-btn"
            onClick={togglePlay}
            style={{
              opacity: isPlaying ? 0 : 0.8,
              transition: "opacity 0.3s",
            }}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </button>
        </div>
      </div>

      <div className="video-controls">
        <div className="controls-row">
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? "⏸️" : "▶️"}
          </button>

          <button onClick={() => skipTime(-5)} className="skip-btn">
            ⏪ 5s
          </button>

          <button onClick={() => skipTime(5)} className="skip-btn">
            5s ⏩
          </button>

          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="volume-control">
            <span>🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>

          <button onClick={toggleFullscreen} className="fullscreen-btn">
            ⛶
          </button>
        </div>

        <div className="progress-row">
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="progress-slider"
          />
        </div>
      </div>
    </div>
  );
};
