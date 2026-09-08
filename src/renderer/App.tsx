import React, { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mark } from "./components/Mark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faFolderOpen,
  faSpinner,
  faFilm,
  faRocket,
  faShare,
  faTags,
  faScissors,
  faCommentDots,
  faChevronLeft,
  faChevronRight,
  faCog,
  faTimes,
  faTrash,
  faQuestionCircle,
  faLayerGroup,
  faList,
  faSun,
  faMoon,
  faChartColumn,
  faHeart,
  faCode,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./styles/App.module.css";
import { DONATION_URL, GITHUB_URL } from "./utils/constants";
import { VideoPlayer } from "./components/VideoPlayer";
import { CategoryManager } from "./components/CategoryManager";
import { ClipCreator } from "./components/ClipCreator";
import { ClipLibrary } from "./components/ClipLibrary";
import { Timeline } from "./components/Timeline";
import { LanguageSelector } from "./components/LanguageSelector";
import { InstructionsModal } from "./components/InstructionsModal";
import { ProjectSelector } from "./components/ProjectSelector";
import { KeyBindingEditor } from "./components/KeyBindingEditor";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { StatsDashboard } from "./components/StatsDashboard";
import { PlayerManager } from "./components/PlayerManager";
import { Clip, Category } from "../types/global";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { useToastContext } from "./contexts/ToastContext";
import { useConfirm } from "./contexts/ConfirmContext";
import { loadPref, savePref, STORAGE_KEYS } from "./utils/storage";
import { formatVideoTime } from "./utils/format";

export const App: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToastContext();
  const { confirm } = useConfirm();
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [markInTime, setMarkInTime] = useState<number | null>(null);
  const [markOutTime, setMarkOutTime] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showClipCreator, setShowClipCreator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [hasExistingProjects, setHasExistingProjects] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_WIDTH, 360));

  // The clip table needs more room than the card grid does. Rather than ship a
  // view that opens truncated, the library asks for the width it needs the
  // first time a coach switches to it. A panel already wider is left alone.
  const ensureSidePanelWidth = useCallback((minimum: number) => {
    setSidePanelWidth(prev => {
      if (prev >= minimum) return prev;
      savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, minimum);
      return minimum;
    });
  }, []);
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_COLLAPSED, true));
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, 300));
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_COLLAPSED, false));
  const [clips, setClips] = useState<Clip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [currentQuarter, setCurrentQuarter] = useState<string | null>(null);

  const resizeRef = useRef<HTMLDivElement>(null);
  const sideResizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const videoPlayerRef = useRef<any>(null);
  const clipCreatorTrapRef = useFocusTrap(showClipCreator);
  const settingsTrapRef = useFocusTrap(showSettings);
  const feedbackTrapRef = useFocusTrap(showFeedback);
  const statsTrapRef = useFocusTrap(showStats);

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  // Check for existing projects on startup
  useEffect(() => {
    const checkExistingProjects = async () => {
      // If the preload bridge never loaded, nothing below can work — surface it
      // instead of silently leaving the window blank.
      if (!window.electronAPI) {
        setStartupError(t("app.startup.apiUnavailable"));
        setShowProjectSelector(true);
        return;
      }
      try {
        // A fatal database failure used to look identical to "zero projects":
        // getProjects() returned [], so no panel showed and no error appeared.
        // Detect it explicitly and keep the Select Project panel reachable.
        const dbStatus = await window.electronAPI.getDbStatus?.();
        if (dbStatus && !dbStatus.ok) {
          setStartupError(
            t("app.startup.dbFailed", {
              error: dbStatus.error ?? "unknown error",
              logPath: dbStatus.logPath ?? "",
            }),
          );
          setShowProjectSelector(true);
          return;
        }

        const projects = await window.electronAPI.getProjects();
        const hasProjects = projects && projects.length > 0;
        setHasExistingProjects(hasProjects);

        // Always open the Select Project panel when no video is loaded — new
        // users included. It's the only entry point for creating a project,
        // importing from YouTube, or loading a saved session. It used to open
        // only when projects already existed, so a first-time user landed on
        // the empty screen with no way to reach it.
        if (!videoPath) {
          setShowProjectSelector(true);
        }
      } catch (error) {
        console.error("Error checking existing projects:", error);
        setStartupError(
          t("app.startup.checkFailed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        // Never dead-end: keep the panel reachable even if the check threw.
        setShowProjectSelector(true);
      }
    };

    checkExistingProjects();
  }, [videoPath, t]);

  // Load clips and categories when refresh trigger changes
  useEffect(() => {
    const loadData = async () => {
      if (currentProject) {
        try {
          const [clipsData, categoriesData] = await Promise.all([
            window.electronAPI.getClips(currentProject.id),
            window.electronAPI.getCategoriesHierarchical(currentProject.id),
          ]);
          setClips(clipsData || []);
          setCategories(categoriesData || []);
        } catch (error) {
          console.error("Error loading data:", error);
        }
      }
    };
    loadData();
  }, [refreshTrigger, currentProject]);

  // Theme management
  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme to document and save to localStorage
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      showSuccess(t("app.settings.themeChanged", {
        mode: next === "dark" ? t("app.settings.darkMode") : t("app.settings.lightMode"),
      }));
      return next;
    });
  };

  // Persist panel state
  useEffect(() => {
    savePref(STORAGE_KEYS.SIDE_PANEL_COLLAPSED, isSidePanelCollapsed);
  }, [isSidePanelCollapsed]);

  // Keyboard access to the two panels. The layout is draggable and the video
  // takes the space one-for-one, so collapsing the clip list is how a coach
  // gets the film big: 323px of video at the default 300px panel, 623px with
  // it collapsed, at a 900px window. Until now that needed a drag to the
  // toolbar. Final Cut binds its equivalents to Control-Command-2 for the
  // timeline and Command-` for the sidebar; digits are the closer fit here
  // because 1 is already the side panel's button and 2 the bottom one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        setIsSidePanelCollapsed(v => !v);
      } else if (e.key === "2") {
        e.preventDefault();
        setIsBottomPanelCollapsed(v => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    savePref(STORAGE_KEYS.BOTTOM_PANEL_COLLAPSED, isBottomPanelCollapsed);
  }, [isBottomPanelCollapsed]);

  // Listen for update lifecycle events. Squirrel reports no download progress,
  // so there's no percentage — just the final downloaded/error signals.
  useEffect(() => {
    window.electronAPI.onUpdateDownloaded((info) => {
      console.log("Update downloaded successfully!");
      showSuccess(t("app.video.updateDownloaded", { version: info?.version ?? "" }));
    });

    window.electronAPI.onUpdateError((err) => {
      console.error("Update error:", err);
      showError(t("app.video.updateError", { message: err?.message ?? "unknown error" }));
    });

    window.electronAPI.onOpenFeedback(() => {
      setShowFeedback(true);
    });

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners("update-downloaded");
      window.electronAPI.removeAllListeners("update-error");
      window.electronAPI.removeAllListeners("open-feedback");
    };
  }, [showSuccess, showError, t]);

  // Handle video seeking from timeline
  const handleTimeSeek = useCallback((time: number) => {
    if (videoPlayerRef.current && videoPlayerRef.current.seekTo) {
      videoPlayerRef.current.seekTo(time);
    }
    setCurrentTime(time);
  }, []);

  // Handle clip selection from timeline
  const handleClipSelect = useCallback(
    (clip: Clip) => {
      setSelectedClip(clip);
      handleTimeSeek(clip.start_time);
    },
    [handleTimeSeek],
  );

  // Handle bottom panel resizing (timeline)
  const startBottomResize = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      e.preventDefault();

      const startY = e.pageY;
      const startHeight = bottomPanelHeight;
      // What the user dragged to, which is not the same as what got rendered:
      // the panel can be shrunk below this by flex when the window is short,
      // and persisting the rendered height ratcheted the preference down.
      let draggedHeight = startHeight;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaY = startY - e.pageY; // Inverted for bottom-to-top resize
        const newHeight = Math.min(Math.max(200, startHeight + deltaY), 600);
        draggedHeight = newHeight;
        setBottomPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        savePref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, draggedHeight);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [bottomPanelHeight],
  );

  // Handle side panel resizing (clips library)
  const startSideResize = useCallback(
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
        // Save final width on mouseup
        const finalEl = sideResizeRef.current;
        if (finalEl) {
          savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, finalEl.clientWidth || sidePanelWidth);
        }
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
    [sidePanelWidth],
  );

  const handleLoadVideoByPath = async (filePath: string) => {
    try {
      setIsLoading(true);
      const videoName = filePath.split("/").pop() || filePath.split("\\").pop() || "Unknown Video";

      // Check if a project already exists for this video
      let project = await window.electronAPI.getProject(filePath);

      if (!project) {
        const projectName = videoName.replace(/\.[^/.]+$/, "");
        project = await window.electronAPI.createProject({
          name: projectName,
          video_path: filePath,
          video_name: videoName,
          description: `Project for ${videoName}`,
        });
      } else {
        await window.electronAPI.updateProjectLastOpened(project.id);
      }

      setCurrentProject(project);
      setVideoPath(filePath);
      setRefreshTrigger((prev) => prev + 1);
      setShowProjectSelector(false);
      setShowInstructions(false);
    } catch (error) {
      console.error("Error loading video:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = async () => {
    try {
      const filePath = await window.electronAPI.selectVideoFile();
      if (filePath) {
        await handleLoadVideoByPath(filePath);
      }
    } catch (error) {
      console.error("Error selecting video:", error);
    }
  };

  const handleSelectProject = async (project: any) => {
    try {
      setIsLoading(true);

      let videoPathToUse = project.video_path;
      let projectToUse = project;

      const existence = await window.electronAPI.checkPathsExist([
        project.video_path,
      ]);
      if (!existence[project.video_path]) {
        const relink = await confirm({
          message: t("app.projects.videoMissingMessage", {
            path: project.video_path,
          }),
          confirmLabel: t("app.projects.videoMissingLocate"),
        });
        if (!relink) {
          return;
        }
        const newPath = await window.electronAPI.selectVideoFile();
        if (!newPath) {
          return;
        }
        const newName =
          newPath.split("/").pop() || newPath.split("\\").pop() || newPath;
        const ok = await window.electronAPI.updateProjectVideoPath(
          project.id,
          newPath,
          newName,
        );
        if (!ok) {
          showError(t("app.projects.videoRelinkError"));
          return;
        }
        videoPathToUse = newPath;
        projectToUse = { ...project, video_path: newPath, video_name: newName };
        showSuccess(t("app.projects.videoRelinkSuccess"));
      }

      await window.electronAPI.updateProjectLastOpened(project.id);

      setCurrentProject(projectToUse);
      setVideoPath(videoPathToUse);
      setRefreshTrigger((prev) => prev + 1);
      setShowProjectSelector(false);
    } catch (error) {
      console.error("Error selecting project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewProject = () => {
    setShowProjectSelector(false);
    handleSelectVideo();
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
    setRefreshTrigger((prev) => prev + 1);
    setShowClipCreator(false);
    handleClearMarks();
  }, [handleClearMarks]);

  const handleQuickTag = useCallback(
    async (keyNumber: number) => {
      if (markInTime === null || markOutTime === null) {
        showError(t("app.clips.creator.errorMarkPoints"));
        return;
      }
      if (!videoPath || !currentProject) return;

      // Build flat list of leaf categories (children, or parents without children)
      const leafCategories: Category[] = [];
      categories.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
          cat.children.forEach(child => leafCategories.push(child));
        } else {
          leafCategories.push(cat);
        }
      });

      const category = leafCategories[keyNumber - 1];
      if (!category || category.id === undefined) return;

      // Generate title using video time
      const videoTime = formatVideoTime(markInTime);
      const title = currentQuarter
        ? `${currentQuarter}_${videoTime}_${category.name}`
        : `${videoTime}_${category.name}`;

      try {
        await window.electronAPI.cutVideoClip({
          inputPath: videoPath,
          startTime: markInTime,
          endTime: markOutTime,
          title,
          categories: [category.id],
          quarter: currentQuarter,
          projectId: currentProject.id,
          overlayImage: videoPlayerRef.current?.getOverlay() ?? undefined,
        });
        showSuccess(t("app.clips.quickTagCreated", { category: category.name }));
      } catch (error) {
        console.error("Error creating quick tag clip:", error);
        showError(t("app.clips.creator.errorCreating"));
      }
    },
    [markInTime, markOutTime, videoPath, currentProject, categories, currentQuarter, showSuccess, showError, t],
  );

  const handleResetDatabase = async () => {
    if (await confirm({ message: t("app.settings.confirmReset"), danger: true })) {
      try {
        await window.electronAPI.resetDatabase();
        setRefreshTrigger((prev) => prev + 1);
        setShowSettings(false);
        showSuccess(t("app.settings.resetSuccess"));
      } catch (error) {
        console.error("Error resetting database:", error);
        showError(t("app.settings.resetError"));
      }
    }
  };

  const handleCategoriesChange = useCallback(() => {
    // Trigger refresh for any components that depend on categories
    setRefreshTrigger((prev) => prev + 1);
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
      {startupError && (
        <div className={styles.startupError} role="alert">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <span>{startupError}</span>
        </div>
      )}
      <header className={styles.appHeader}>
        <h1 className={styles.title}>
          <Mark /> {t("app.title")}
        </h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setShowProjectSelector(true)}
            title={t("app.projects.selectProject")}
          >
            <FontAwesomeIcon icon={faFolderOpen} />{" "}
            {t("app.projects.selectProject")}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setIsSidePanelCollapsed(!isSidePanelCollapsed)}
          >
            <FontAwesomeIcon icon={faList} />{" "}
            {isSidePanelCollapsed
              ? t("app.buttons.showSidePanel")
              : t("app.buttons.hideSidePanel")}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
          >
            <FontAwesomeIcon icon={faLayerGroup} />{" "}
            {isBottomPanelCollapsed
              ? t("app.buttons.showBottomPanel")
              : t("app.buttons.hideBottomPanel")}
          </button>
          {currentProject && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => setShowStats(true)}
            >
              <FontAwesomeIcon icon={faChartColumn} /> {t("app.stats.stats")}
            </button>
          )}
          <button
            type="button"
            className={styles.settingsButton}
            onClick={() => setShowSettings(true)}
          >
            <FontAwesomeIcon icon={faCog} /> {t("app.buttons.settings")}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setShowShortcuts(true)}
            title={t("app.shortcuts.title")}
            aria-label={t("app.shortcuts.title")}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.contentWithSidePanel}>
          <div className={styles.videoContainer}>
            <div className={styles.videoSection}>
              <VideoPlayer
                ref={videoPlayerRef}
                videoPath={videoPath}
                projectId={currentProject?.id}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                markInTime={markInTime}
                markOutTime={markOutTime}
                onMarkIn={handleMarkIn}
                onMarkOut={handleMarkOut}
                onClearMarks={handleClearMarks}
                onQuickTag={handleQuickTag}
              />
            </div>

            {/* Bottom Panel - Timeline */}
            <div
              className={`${styles.bottomPanel} ${
                isBottomPanelCollapsed ? styles.bottomPanelCollapsed : ""
              }`}
              style={
                {
                  height: isBottomPanelCollapsed ? 0 : `${bottomPanelHeight}px`,
                  "--panel-height": `${bottomPanelHeight}px`,
                } as React.CSSProperties
              }
              ref={resizeRef}
            >
              {!isBottomPanelCollapsed && (
                <div
                  className={styles.resizeHandle}
                  onMouseDown={startBottomResize}
                  title={t("app.buttons.resizeTimeline")}
                />
              )}
              <div className={styles.timelineContent}>
                {currentProject && (
                  <Timeline
                    clips={clips}
                    categories={categories}
                    currentTime={currentTime}
                    videoDuration={duration}
                    onTimeSeek={handleTimeSeek}
                    onClipSelect={handleClipSelect}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Side Panel - Clips Library */}
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
            ref={sideResizeRef}
          >
            {!isSidePanelCollapsed && (
              <div
                className={styles.sideResizeHandle}
                onMouseDown={startSideResize}
                title={t("app.buttons.resizeClips")}
              />
            )}
            <div className={styles.clipLibraryPanel}>
              <ClipLibrary
                onRefresh={refreshTrigger}
                currentProject={currentProject}
                onRequestWidth={ensureSidePanelWidth}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Clip Creator Modal */}
      {showClipCreator && (
        <div
          ref={clipCreatorTrapRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clip-creator-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowClipCreator(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowClipCreator(false); }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="clip-creator-title">
                <FontAwesomeIcon icon={faScissors} />{" "}
                {t("app.modals.createClip")}
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowClipCreator(false)}
                aria-label={t("app.buttons.close")}
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
                currentQuarter={currentQuarter}
                onQuarterChange={setCurrentQuarter}
                getOverlay={() => videoPlayerRef.current?.getOverlay() ?? null}
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          ref={settingsTrapRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowSettings(false); }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="settings-title">
                <FontAwesomeIcon icon={faCog} /> {t("app.modals.settings")}
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowSettings(false)}
                aria-label={t("app.buttons.close")}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* General Section */}
              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  {t("app.settings.general")}
                </h3>
                <div className={styles.settingsRow}>
                  <LanguageSelector />
                </div>
                <div className={styles.settingsRow}>
                  <span>{t("app.settings.theme")}</span>
                  <button
                    type="button"
                    className={styles.themeToggle}
                    onClick={toggleTheme}
                  >
                    <FontAwesomeIcon icon={theme === "dark" ? faMoon : faSun} />{" "}
                    {theme === "dark"
                      ? t("app.settings.darkMode")
                      : t("app.settings.lightMode")}
                  </button>
                </div>
                <div className={styles.settingsRow}>
                  <button
                    type="button"
                    className={styles.themeToggle}
                    onClick={() => {
                      setShowSettings(false);
                      setShowInstructions(true);
                    }}
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />{" "}
                    {t("app.settings.showInstructions")}
                  </button>
                </div>
              </div>

              {/* Key Bindings Section */}
              <div className={styles.settingsSection}>
                <KeyBindingEditor />
              </div>

              {/* Categories Section */}
              <div className={styles.settingsSection}>
                <CategoryManager
                  currentProject={currentProject}
                  onCategoriesChange={() => setRefreshTrigger((prev) => prev + 1)}
                />
              </div>

              {/* Players Section */}
              {currentProject && (
                <div className={styles.settingsSection}>
                  <PlayerManager
                    currentProject={currentProject}
                    onPlayersChange={() => setRefreshTrigger((prev) => prev + 1)}
                  />
                </div>
              )}

              {/* About Section */}
              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  {t("app.settings.about")}
                </h3>
                <div className={styles.settingsRow}>
                  <span>{t("app.settings.version", { version: appVersion })}</span>
                </div>
                <div className={styles.settingsRow}>
                  <button
                    type="button"
                    className={styles.themeToggle}
                    onClick={() => window.electronAPI.openExternal(GITHUB_URL)}
                  >
                    <FontAwesomeIcon icon={faCode} /> {t("app.settings.viewOnGithub")}
                  </button>
                  <button
                    type="button"
                    className={styles.themeToggle}
                    onClick={() => window.electronAPI.openExternal(DONATION_URL)}
                  >
                    <FontAwesomeIcon icon={faHeart} /> {t("app.settings.supportProject")}
                  </button>
                </div>
              </div>

              {/* Danger Zone Section */}
              <div className={styles.settingsSection}>
                <div className={styles.dangerZone}>
                  <h3>{t("app.settings.dangerZone")}</h3>
                  <button
                    type="button"
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
        </div>
      )}

      {/* Instructions Modal — opened manually from Settings */}
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => {
          setShowInstructions(false);
        }}
        onSelectVideo={() => {
          handleSelectVideo();
        }}
        showSelectVideoButton={true}
      />

      {/* Project Selector Modal */}
      <ProjectSelector
        isOpen={showProjectSelector}
        onClose={() => setShowProjectSelector(false)}
        onSelectProject={handleSelectProject}
        onCreateNew={handleCreateNewProject}
        onLoadVideoByPath={handleLoadVideoByPath}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Stats Dashboard Modal */}
      {showStats && (
        <div
          ref={statsTrapRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stats-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStats(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowStats(false); }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="stats-title">
                <FontAwesomeIcon icon={faChartColumn} /> {t("app.stats.title")}
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowStats(false)}
                aria-label={t("app.buttons.close")}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <StatsDashboard
                clips={clips}
                categories={categories}
                videoDuration={duration}
                projectId={currentProject?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div
          ref={feedbackTrapRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowFeedback(false); }}
        >
          <div className={styles.modalContent} style={{ maxWidth: 520 }}>
            <div className={styles.modalHeader}>
              <h2 id="feedback-title">
                <FontAwesomeIcon icon={faCommentDots} />{" "}
                {t("app.modals.feedback")}
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowFeedback(false)}
                aria-label={t("app.buttons.close")}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <FeedbackModal onClose={() => setShowFeedback(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
