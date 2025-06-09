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
  faLocationPin,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { ResizableBox } from "react-resizable";
import { Resizable } from "re-resizable";
import styles from "./styles/App.module.css";
import { VideoPlayer } from "./components/VideoPlayer";
import { CategoryManager } from "./components/CategoryManager";
import { ClipCreator } from "./components/ClipCreator";
import { ClipLibrary } from "./components/ClipLibrary";

export const App: React.FC = () => {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [markInTime, setMarkInTime] = useState<number | null>(null);
  const [markOutTime, setMarkOutTime] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsWidth, setControlsWidth] = useState(400);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [clipCreatorHeight, setClipCreatorHeight] = useState(300);
  const [categoryManagerHeight, setCategoryManagerHeight] = useState(300);

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

  const handleControlsResize = (
    e: any,
    { size }: { size: { width: number } }
  ) => {
    setControlsWidth(size.width);
  };

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1>
              <FontAwesomeIcon icon={faBasketball} /> Basketball Video Analyzer
            </h1>
            <p>Cut and organize your basketball game clips</p>
          </div>

          <button onClick={handleSelectVideo} className={styles.selectVideoBtn}>
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

        {videoPath && (
          <div className={styles.videoInfo}>
            <div className={styles.videoDetails}>
              <div className={styles.videoName}>
                <FontAwesomeIcon icon={faVideo} /> {getVideoFileName()}
              </div>
              <div className={styles.videoTime}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {(markInTime !== null || markOutTime !== null) && (
              <div className={styles.markInfo}>
                <span>
                  <FontAwesomeIcon icon={faLocationPin} /> Marks:{" "}
                  {markInTime !== null && `IN: ${formatTime(markInTime)}`}{" "}
                  {markOutTime !== null && `OUT: ${formatTime(markOutTime)}`}
                </span>
                {markInTime !== null && markOutTime !== null && (
                  <span className={styles.durationDisplay}>
                    Duration: {formatTime(markOutTime - markInTime)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <main className={styles.mainContent}>
        <div className={styles.videoSection}>
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

        <ResizableBox
          width={isControlsCollapsed ? 40 : controlsWidth}
          height={Infinity}
          minConstraints={[40, Infinity]}
          maxConstraints={[800, Infinity]}
          axis="x"
          resizeHandles={["w"]}
          onResize={handleControlsResize}
          className={`${styles.controlsSection} ${
            isControlsCollapsed ? styles.controlsCollapsed : ""
          }`}
        >
          <button
            className={styles.collapseButtonBase}
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
          >
            <FontAwesomeIcon
              icon={isControlsCollapsed ? faChevronRight : faChevronLeft}
            />
          </button>

          <div className={styles.controlPanels}>
            <Resizable
              size={{ width: "100%", height: clipCreatorHeight }}
              minHeight={200}
              maxHeight={800}
              enable={{ bottom: true }}
              onResizeStop={(e, direction, ref, d) => {
                setClipCreatorHeight(clipCreatorHeight + d.height);
              }}
              className={styles.controlPanelResizable}
            >
              <div className={styles.controlPanel}>
                <ClipCreator
                  videoPath={videoPath}
                  markInTime={markInTime}
                  markOutTime={markOutTime}
                  onClipCreated={handleClipCreated}
                  onClearMarks={handleClearMarks}
                />
              </div>
            </Resizable>

            <Resizable
              size={{ width: "100%", height: categoryManagerHeight }}
              minHeight={200}
              maxHeight={800}
              enable={{ bottom: true }}
              onResizeStop={(e, direction, ref, d) => {
                setCategoryManagerHeight(categoryManagerHeight + d.height);
              }}
              className={styles.controlPanelResizable}
            >
              <div className={styles.controlPanel}>
                <CategoryManager onCategoriesChange={handleCategoriesChange} />
              </div>
            </Resizable>

            <div
              className={`${styles.controlPanel} ${styles.clipLibraryPanel}`}
            >
              <ClipLibrary onRefresh={refreshTrigger} />
            </div>
          </div>
        </ResizableBox>
      </main>

      {/* Instructions Overlay */}
      {!videoPath && (
        <div className={styles.instructionsOverlay}>
          <div className={styles.instructionsContent}>
            <h2>
              <FontAwesomeIcon icon={faFilm} /> Welcome to Basketball Clip
              Cutter
            </h2>
            <p>
              Perfect for creating and organizing basketball clips for team
              scouting
            </p>

            <div className={styles.workflowSteps}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h3>
                    <FontAwesomeIcon icon={faVideo} /> Load Video
                  </h3>
                  <p>Select your basketball game video file</p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h3>
                    <FontAwesomeIcon icon={faScissors} /> Mark Clips
                  </h3>
                  <p>
                    Use <kbd>I</kbd> and <kbd>O</kbd> keys to mark in/out points
                    during playback
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h3>
                    <FontAwesomeIcon icon={faTags} /> Categorize
                  </h3>
                  <p>
                    Tag clips with custom categories (Rebounds, Screens, Player
                    actions, etc.)
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <div className={styles.stepContent}>
                  <h3>
                    <FontAwesomeIcon icon={faShare} /> Share
                  </h3>
                  <p>Export clips by category to share with your team</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSelectVideo}
              className={styles.getStartedBtn}
            >
              <FontAwesomeIcon icon={faRocket} /> Get Started - Select Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
