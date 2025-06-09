import React, { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBasketball,
  faVideo,
  faFolderOpen,
  faSpinner,
  faFilm,
  faRocket,
  faShare,
  faTags,
  faScissors,
} from "@fortawesome/free-solid-svg-icons";
import { VideoPlayer } from "./components/VideoPlayer";
import { CategoryManager } from "./components/CategoryManager";
import { ClipCreator } from "./components/ClipCreator";
import { ClipLibrary } from "./components/ClipLibrary";
import "./App.css";

export const App: React.FC = () => {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [markInTime, setMarkInTime] = useState<number | null>(null);
  const [markOutTime, setMarkOutTime] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectVideo = async () => {
    try {
      setIsLoading(true);
      const filePath = await window.electronAPI.selectVideoFile();
      if (filePath) {
        setVideoPath(filePath);
        // Reset marks when new video is loaded
        setMarkInTime(null);
        setMarkOutTime(null);
        setCurrentTime(0);
        setDuration(0);
      }
    } catch (error) {
      console.error("Error selecting video:", error);
      alert("Error loading video file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkIn = useCallback(() => {
    setMarkInTime(currentTime);
    // If mark out is before mark in, clear it
    if (markOutTime !== null && markOutTime <= currentTime) {
      setMarkOutTime(null);
    }
  }, [currentTime, markOutTime]);

  const handleMarkOut = useCallback(() => {
    setMarkOutTime(currentTime);
    // If mark in is after mark out, clear it
    if (markInTime !== null && markInTime >= currentTime) {
      setMarkInTime(null);
    }
  }, [currentTime, markInTime]);

  const handleClearMarks = useCallback(() => {
    setMarkInTime(null);
    setMarkOutTime(null);
  }, []);

  const handleClipCreated = useCallback(() => {
    // Refresh the clip library
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleCategoriesChange = useCallback(() => {
    // Trigger refresh for any components that depend on categories
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getVideoFileName = (): string => {
    if (!videoPath) return "";
    return videoPath.split("/").pop() || videoPath.split("\\").pop() || "";
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>
              <FontAwesomeIcon icon={faBasketball} /> Basketball Clip Cutter
            </h1>
            <p>Create and organize video clips for team scouting</p>
          </div>

          <div className="header-controls">
            <button
              onClick={handleSelectVideo}
              className="select-video-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Loading...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFolderOpen} /> Select Video
                </>
              )}
            </button>
          </div>
        </div>

        {videoPath && (
          <div className="video-info">
            <div className="video-details">
              <span className="video-name">
                <FontAwesomeIcon icon={faVideo} /> {getVideoFileName()}
              </span>
              <span className="video-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {(markInTime !== null || markOutTime !== null) && (
              <div className="mark-info">
                {markInTime !== null && (
                  <span className="mark-display">
                    In: {formatTime(markInTime)}
                  </span>
                )}
                {markOutTime !== null && (
                  <span className="mark-display">
                    Out: {formatTime(markOutTime)}
                  </span>
                )}
                {markInTime !== null && markOutTime !== null && (
                  <span className="duration-display">
                    Duration: {formatTime(markOutTime - markInTime)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Video Section */}
        <div className="video-section">
          <VideoPlayer
            videoPath={videoPath}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            markInTime={markInTime}
            markOutTime={markOutTime}
            onMarkIn={handleMarkIn}
            onMarkOut={handleMarkOut}
            onClearMarks={handleClearMarks}
          />
        </div>

        {/* Controls Section */}
        <div className="controls-section">
          {/* Category Management */}
          <div className="control-panel">
            <CategoryManager onCategoriesChange={handleCategoriesChange} />
          </div>

          {/* Clip Creation */}
          <div className="control-panel">
            <ClipCreator
              videoPath={videoPath}
              markInTime={markInTime}
              markOutTime={markOutTime}
              onClipCreated={handleClipCreated}
              onClearMarks={handleClearMarks}
            />
          </div>
        </div>
      </div>

      {/* Clip Library */}
      <div className="library-section">
        <ClipLibrary onRefresh={refreshTrigger} />
      </div>

      {/* Instructions Overlay */}
      {!videoPath && (
        <div className="instructions-overlay">
          <div className="instructions-content">
            <h2>
              <FontAwesomeIcon icon={faFilm} /> Welcome to Basketball Clip
              Cutter
            </h2>
            <p>
              Perfect for creating and organizing basketball clips for team
              scouting
            </p>

            <div className="workflow-steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>
                    <FontAwesomeIcon icon={faVideo} /> Load Video
                  </h3>
                  <p>Select your basketball game video file</p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>
                    <FontAwesomeIcon icon={faScissors} /> Mark Clips
                  </h3>
                  <p>
                    Use <kbd>I</kbd> and <kbd>O</kbd> keys to mark in/out points
                    during playback
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>
                    <FontAwesomeIcon icon={faTags} /> Categorize
                  </h3>
                  <p>
                    Tag clips with custom categories (Rebounds, Screens, Player
                    actions, etc.)
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>
                    <FontAwesomeIcon icon={faShare} /> Share
                  </h3>
                  <p>Export clips by category to share with your team</p>
                </div>
              </div>
            </div>

            <button onClick={handleSelectVideo} className="get-started-btn">
              <FontAwesomeIcon icon={faRocket} /> Get Started - Select Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
