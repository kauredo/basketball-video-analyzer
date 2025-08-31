import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  faChevronLeft,
  faChevronRight,
  faCog,
  faTimes,
  faTrash,
  faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./styles/App.module.css";
import { VideoPlayer } from "./components/VideoPlayer";
import { CategoryManager } from "./components/CategoryManager";
import { ClipCreator } from "./components/ClipCreator";
import { ClipLibrary } from "./components/ClipLibrary";
import { LanguageSelector } from "./components/LanguageSelector";
import { InstructionsModal } from "./components/InstructionsModal";
import { KeyBindingEditor } from "./components/KeyBindingEditor";

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [markInTime, setMarkInTime] = useState<number | null>(null);
  const [markOutTime, setMarkOutTime] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false);
  const [showClipCreator, setShowClipCreator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState(360); // Default panel width

  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Handle panel resizing
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      e.preventDefault();

      const startX = e.pageX;
      const startWidth = sidePanelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaX = startX - e.pageX; // Inverted for right-to-left resize
        const newWidth = Math.min(Math.max(280, startWidth + deltaX), 600);
        setSidePanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [sidePanelWidth]
  );

  const handleSelectVideo = async () => {
    try {
      setIsLoading(true);
      const filePath = await window.electronAPI.selectVideoFile();
      if (filePath) {
        // Check if a project already exists for this video
        let project = await window.electronAPI.getProject(filePath);

        if (!project) {
          // Create a new project for this video
          const videoName = filePath.split(/[/\\]/).pop() || "Untitled Video";
          const projectName = videoName.replace(/\.[^/.]+$/, ""); // Remove extension

          project = await window.electronAPI.createProject({
            name: projectName,
            video_path: filePath,
            video_name: videoName,
            description: `Project for ${videoName}`,
          });
        } else {
          // Update last opened time for existing project
          await window.electronAPI.updateProjectLastOpened(project.id);
        }

        setCurrentProject(project);
        setVideoPath(filePath);
        // Reset marks when new video is loaded
        setMarkInTime(null);
        setMarkOutTime(null);
        setCurrentTime(0);
        setDuration(0);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error selecting video:", error);
      alert(t("app.video.loadingError"));
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
    // Show clip creator modal when user marks out a clip
    setShowClipCreator(true);
  }, [currentTime, markInTime]);

  const handleClearMarks = useCallback(() => {
    setMarkInTime(null);
    setMarkOutTime(null);
    setShowClipCreator(false);
  }, []);

  const handleClipCreated = useCallback(() => {
    // Refresh the clip library
    setRefreshTrigger(prev => prev + 1);
    setShowClipCreator(false);
    handleClearMarks();
  }, [handleClearMarks]);

  const handleResetDatabase = async () => {
    if (window.confirm(t("app.settings.confirmReset"))) {
      try {
        await window.electronAPI.resetDatabase();
        setRefreshTrigger(prev => prev + 1);
        setShowSettings(false);
        alert(t("app.settings.resetSuccess"));
      } catch (error) {
        console.error("Error resetting database:", error);
        alert(t("app.settings.resetError"));
      }
    }
  };

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
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <h1>
          <FontAwesomeIcon icon={faBasketball} /> {t("app.title")}
        </h1>
        <div className={styles.headerActions}>
          <button
            className={styles.btn}
            onClick={() => setIsSidePanelCollapsed(!isSidePanelCollapsed)}
          >
            <FontAwesomeIcon icon={faFilm} />{" "}
            {isSidePanelCollapsed
              ? t("app.buttons.showSidePanel")
              : t("app.buttons.hideSidePanel")}
          </button>
          <button
            className={styles.settingsButton}
            onClick={() => setShowSettings(true)}
          >
            <FontAwesomeIcon icon={faCog} /> {t("app.buttons.settings")}
          </button>
        </div>
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

        <div
          className={`${styles.sidePanel} ${
            isSidePanelCollapsed ? styles.sidePanelCollapsed : ""
          }`}
          style={
            {
              width: isSidePanelCollapsed ? 0 : `${sidePanelWidth}px`,
              "--panel-width": `${sidePanelWidth}px`,
            } as React.CSSProperties
          }
          ref={resizeRef}
        >
          {!isSidePanelCollapsed && (
            <div
              className={styles.resizeHandle}
              onMouseDown={startResize}
              title="Drag to resize panel"
            />
          )}
          <div className={styles.clipLibraryPanel}>
            <ClipLibrary
              onRefresh={refreshTrigger}
              currentProject={currentProject}
            />
          </div>
        </div>
      </main>

      {/* Clip Creator Modal */}
      {showClipCreator && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>
                <FontAwesomeIcon icon={faScissors} />{" "}
                {t("app.modals.createClip")}
              </h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowClipCreator(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <ClipCreator
                videoPath={videoPath}
                markInTime={markInTime}
                markOutTime={markOutTime}
                onClipCreated={handleClipCreated}
                onClearMarks={handleClearMarks}
                currentProject={currentProject}
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>
                <FontAwesomeIcon icon={faCog} /> {t("app.modals.settings")}
              </h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowSettings(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <LanguageSelector />

              <KeyBindingEditor />

              <button
                className={styles.instructionsButton}
                onClick={() => {
                  setShowInstructions(true);
                  setShowSettings(false);
                }}
              >
                <FontAwesomeIcon icon={faQuestionCircle} />{" "}
                {t("app.buttons.showInstructions")}
              </button>

              <CategoryManager
                onCategoriesChange={() => setRefreshTrigger(prev => prev + 1)}
              />

              <div className={styles.dangerZone}>
                <h3>{t("app.settings.dangerZone")}</h3>
                <button
                  className={styles.resetButton}
                  onClick={handleResetDatabase}
                >
                  <FontAwesomeIcon icon={faTrash} />{" "}
                  {t("app.buttons.resetDatabase")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      <InstructionsModal
        isOpen={!videoPath || showInstructions}
        onClose={() => setShowInstructions(false)}
        onSelectVideo={handleSelectVideo}
        showSelectVideoButton={!videoPath}
      />
    </div>
  );
};
