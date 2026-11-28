import type { ProjectVideo } from "../main/projectVideos";
import { isSamePath } from "../shared/clipDrawings";
import { activeRecordingKey } from "./utils/projectPlayback";
import React, { useState, useCallback, useRef, useEffect, useMemo, useReducer } from "react";
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
import { ProjectSelector, type Project } from "./components/ProjectSelector";
import { VideoProjectChooser } from "./components/VideoProjectChooser";
import { KeyBindingEditor } from "./components/KeyBindingEditor";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { StatsDashboard } from "./components/StatsDashboard";
import { PlayerManager } from "./components/PlayerManager";
import { ConvertProgress } from "./components/ConvertProgress";
import { Clip, Category } from "../types/global";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { useToastContext } from "./contexts/ToastContext";
import { useConfirm } from "./contexts/ConfirmContext";
import { loadPref, savePref, STORAGE_KEYS } from "./utils/storage";
import { withCause } from "./utils/errors";
import { formatVideoTime } from "./utils/format";
import { parseListWidth, type ListWidth } from "./utils/clipList";
import {
  BOTTOM_MAX,
  BOTTOM_MIN,
  LAYOUT_PRESET_IDS,
  SIDE_MAX,
  SIDE_MIN,
  parsePresetState,
  presetLayoutFor,
  presetReducer,
  type LayoutPresetId,
} from "./utils/layoutPresets";

// The header's preset diagrams: each fills the region its preset favours.
const PresetDiagram: React.FC<{ id: LayoutPresetId }> = ({ id }) => (
  <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {id === "tag" && (
      <>
        <rect className={styles.presetRegion} x="12" y=".75" width="9.25" height="14.5" fill="currentColor" fillOpacity=".45" stroke="none" />
        <rect x=".75" y=".75" width="20.5" height="14.5" />
        <path d="M12 .75v14.5" />
      </>
    )}
    {id === "study" && (
      <>
        <rect className={styles.presetRegion} x=".75" y="6.25" width="20.5" height="9" fill="currentColor" fillOpacity=".45" stroke="none" />
        <rect x=".75" y=".75" width="20.5" height="14.5" />
        <path d="M.75 6.25h20.5" />
      </>
    )}
    {id === "scout" && (
      <>
        <rect className={styles.presetRegion} x=".75" y=".75" width="17" height="11.5" fill="currentColor" fillOpacity=".45" stroke="none" />
        <rect x=".75" y=".75" width="20.5" height="14.5" />
        <path d="M17.75 .75v14.5M.75 12.25h17" />
      </>
    )}
  </svg>
);

export const App: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToastContext();
  const { confirm } = useConfirm();
  const [recordings, setRecordings] = useState<ProjectVideo[]>([]);
  const recordingRequest = useRef(0);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [playerReload, setPlayerReload] = useState(0);
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
  const [chooser, setChooser] = useState<{
    filePath: string;
    videoName: string;
    projects: Project[];
  } | null>(null);
  const creatingProject = useRef(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsGame, setStatsGame] = useState<number | null>(null);
  const [hasExistingProjects, setHasExistingProjects] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_WIDTH, 360));
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.SIDE_PANEL_COLLAPSED, true));
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, 300));
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(() => loadPref(STORAGE_KEYS.BOTTOM_PANEL_COLLAPSED, false));
  const [bottomListWidth, setBottomListWidth] = useState<ListWidth>(() =>
    parseListWidth(loadPref<unknown>(STORAGE_KEYS.BOTTOM_LIST_WIDTH, "narrow")));
  // Plan 048's layout presets call this too, so a preset change persists like a manual one.
  const changeBottomListWidth = useCallback((width: ListWidth) => {
    setBottomListWidth(width);
    savePref(STORAGE_KEYS.BOTTOM_LIST_WIDTH, width);
  }, []);
  // Which layout preset is selected, and whether the coach has changed the
  // layout by hand since. Every manual layout change calls markLayoutEdited.
  const [presetState, dispatchPreset] = useReducer(presetReducer, undefined,
    () => parsePresetState(loadPref<unknown>(STORAGE_KEYS.LAYOUT_PRESET, null)));
  useEffect(() => { savePref(STORAGE_KEYS.LAYOUT_PRESET, presetState); }, [presetState]);
  const markLayoutEdited = useCallback(() => dispatchPreset({ type: "manualChange" }), []);
  const onUserListWidthChange = useCallback((w: ListWidth) => {
    if (w === bottomListWidth) return;
    changeBottomListWidth(w);
    markLayoutEdited();
  }, [bottomListWidth, changeBottomListWidth, markLayoutEdited]);
  const mainRef = useRef<HTMLElement>(null);
  const applyPreset = useCallback((id: LayoutPresetId) => {
    // <main>'s size does not depend on the panels, so measuring before
    // un-collapsing them does not skew the clamp.
    const el = mainRef.current;
    const size = el
      ? { width: el.clientWidth, height: el.clientHeight }
      : { width: window.innerWidth, height: window.innerHeight - 60 };
    const layout = presetLayoutFor(id, size);
    setSidePanelWidth(layout.sidePanelWidth);
    savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, layout.sidePanelWidth);
    setBottomPanelHeight(layout.bottomPanelHeight);
    savePref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, layout.bottomPanelHeight);
    changeBottomListWidth(layout.bottomListWidth);
    setIsSidePanelCollapsed(false);
    setIsBottomPanelCollapsed(false);
    dispatchPreset({ type: "apply", id });
  }, [changeBottomListWidth]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [currentQuarter, setCurrentQuarter] = useState<string | null>(null);

  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const videoPlayerRef = useRef<any>(null);
  const clipCreatorTrapRef = useFocusTrap(showClipCreator);
  const settingsTrapRef = useFocusTrap(showSettings);
  const feedbackTrapRef = useFocusTrap(showFeedback);
  const statsTrapRef = useFocusTrap(showStats);

  // The court map plays clips with sound; however Stats opens, don't play
  // over the main video.
  useEffect(() => {
    if (showStats) videoPlayerRef.current?.pause?.();
  }, [showStats]);

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
        markLayoutEdited();
      } else if (e.key === "2") {
        e.preventDefault();
        setIsBottomPanelCollapsed(v => !v);
        markLayoutEdited();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [markLayoutEdited]);

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
        const newHeight = Math.min(Math.max(BOTTOM_MIN, startHeight + deltaY), BOTTOM_MAX);
        draggedHeight = newHeight;
        setBottomPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        savePref(STORAGE_KEYS.BOTTOM_PANEL_HEIGHT, draggedHeight);
        // A click on the handle without moving is not an edit.
        if (draggedHeight !== startHeight) markLayoutEdited();
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
    [bottomPanelHeight, markLayoutEdited],
  );

  // Handle side panel resizing (clips library)
  // The clip table needs more room than the card grid does. Rather than ship a
  // view that opens truncated, the library asks for the width it needs the
  // first time a coach switches to it. A panel already wider is left alone.
  // The view asked for this width, the coach did not drag to it, so the
  // selected preset is not marked edited.
  const ensureSidePanelWidth = useCallback((minimum: number) => {
    setSidePanelWidth(prev => {
      if (prev >= minimum) return prev;
      savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, minimum);
      return minimum;
    });
  }, []);

  const startSideResize = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      e.preventDefault();

      const startX = e.pageX;
      const startWidth = sidePanelWidth;
      // What the user dragged to, saved instead of the rendered width for the
      // same reason as the bottom panel: the rendered clientWidth leaves out
      // the 1px border and any flex shrink, so saving it ratcheted the
      // preference down a pixel on every click of the handle.
      let draggedWidth = startWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaX = startX - e.pageX; // Inverted for right-to-left resize
        const newWidth = Math.min(Math.max(SIDE_MIN, startWidth + deltaX), SIDE_MAX);
        draggedWidth = newWidth;
        setSidePanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        savePref(STORAGE_KEYS.SIDE_PANEL_WIDTH, draggedWidth);
        if (draggedWidth !== startWidth) markLayoutEdited();
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
    [sidePanelWidth, markLayoutEdited],
  );

  const projectNameFor = (videoName: string) => videoName.replace(/\.[^/.]+$/, "");

  const activateRecording = (projectId: number, recording: ProjectVideo, time: number | null = null) => {
    if (videoPath === recording.video_path && currentProject?.id === projectId) {
      if (time !== null) handleTimeSeek(time);
      return;
    }
    setCurrentTime(0);
    setDuration(0);
    setMarkInTime(null);
    setMarkOutTime(null);
    setCurrentQuarter(null);
    setStartAt(time);
    setVideoPath(recording.video_path);
    savePref(activeRecordingKey(projectId), recording.id);
  };

  const openProject = async (project: Project, filePath: string) => {
    const request = ++recordingRequest.current;
    const videos = await window.electronAPI.getProjectVideos(project.id);
    if (request !== recordingRequest.current) return;
    const video = videos.find(item => isSamePath(item.video_path, filePath));
    if (!video) throw new Error("Project recording missing");
    activateRecording(project.id, video);
    setRecordings(videos);
    setCurrentProject(project);
    setRefreshTrigger((prev) => prev + 1);
    setShowProjectSelector(false);
    setShowInstructions(false);
  };

  // Asks for the moved file and relinks the recording to it. Null when the coach gives up or it fails.
  // `ask` is false when the coach already pressed Locate video.
  // `pick` is the playable-copy button's conversion, in place of the file picker.
  const locateRecording = async (missingPath: string, ask = true, pick = window.electronAPI.selectVideoFile) => {
    if (ask && !(await confirm({ message: t("app.projects.videoMissingMessage", { path: missingPath }),
      confirmLabel: t("app.projects.videoMissingLocate") }))) return null;
    const path = await pick();
    if (!path) return null;
    const name = path.split(/[/\\]/).pop() ?? path;
    const result = await window.electronAPI.relinkVideoPath(missingPath, path, name);
    if (result !== "ok") {
      showError(t(result === "duplicate" ? "app.projects.videoRelinkDuplicate" : "app.projects.videoRelinkError"));
      return null;
    }
    showSuccess(t("app.projects.videoRelinkSuccess"));
    return { path, name };
  };

  const switchRecording = async (recording: ProjectVideo, time: number | null = null) => {
    if (!currentProject || recording.project_id !== currentProject.id) return;
    const request = ++recordingRequest.current;
    try {
      const id = currentProject.id;
      const files = await window.electronAPI.checkPathsExist([recording.video_path]);
      if (request !== recordingRequest.current) return;
      if (!files[recording.video_path]) {
        await relocate(recording, request, time, true);
        return;
      }
      activateRecording(id, recording, time);
    } catch (error) {
      showError(withCause(t("app.projects.recordingError"), error));
    }
  };

  // Relinks a recording to the file the coach picks and plays it from there.
  const relocate = async (
    recording: ProjectVideo, request: number, time: number | null, ask: boolean,
    pick?: () => Promise<string | null>,
  ) => {
    if (!currentProject) return;
    const id = currentProject.id;
    const located = await locateRecording(recording.video_path, ask, pick);
    if (!located || request !== recordingRequest.current) return;
    const videos = await window.electronAPI.getProjectVideos(id);
    const updated = videos.find(video => video.id === recording.id);
    if (!updated || request !== recordingRequest.current) return;
    setRecordings(videos);
    if (currentProject.video_path === recording.video_path) {
      setCurrentProject({ ...currentProject, video_path: located.path, video_name: located.name });
    }
    // Picking the same file again keeps the path, so the player has to be remounted to retry it.
    setPlayerReload(count => count + 1);
    activateRecording(id, updated, time);
    refreshClips();
  };

  // The player's Locate video button, for a received video that changed in the shared folder.
  const locateActiveRecording = async () => {
    const recording = recordings.find(item => item.video_path === videoPath);
    if (!recording) return;
    try {
      await relocate(recording, ++recordingRequest.current, null, false);
    } catch (error) {
      showError(withCause(t("app.projects.recordingError"), error));
    }
  };

  // The player's "Make a playable copy" button: the copy replaces the game's video.
  const convertActiveRecording = async () => {
    const recording = recordings.find(item => item.video_path === videoPath);
    if (!recording) return;
    try {
      await relocate(recording, ++recordingRequest.current, null, false,
        () => window.electronAPI.convertProjectVideo(recording.video_path));
    } catch (error) {
      showError(withCause(t("app.projects.recordingError"), error));
    }
  };

  // False when no game in the project has the clip's video.
  const handleClipSelect = (clip: Clip): boolean => {
    if (videoPath && isSamePath(clip.video_path, videoPath)) {
      handleTimeSeek(clip.start_time);
      return true;
    }
    const recording = recordings.find(video => isSamePath(video.video_path, clip.video_path));
    if (!recording) return false;
    void switchRecording(recording, clip.start_time);
    return true;
  };

  const handleAddRecording = async () => {
    if (!currentProject || isLoading) return;
    const id = currentProject.id;
    const request = ++recordingRequest.current;
    try {
      setIsLoading(true);
      const recording = await window.electronAPI.addProjectVideo(id);
      if (recording) {
        const videos = await window.electronAPI.getProjectVideos(id);
        if (request !== recordingRequest.current) return;
        setRecordings(videos);
        activateRecording(id, recording);
      }
    } catch (error) {
      showError(withCause(t("app.projects.recordingError"), error));
    } finally {
      setIsLoading(false);
    }
  };

  const activeRecording = recordings.find(recording => recording.video_path === videoPath);
  const gameClips = useMemo(() => clips.filter(clip => videoPath && isSamePath(clip.video_path, videoPath)), [clips, videoPath]);

  const handleChooserOpen = async (project: Project) => {
    if (!chooser) return;
    await window.electronAPI.updateProjectLastOpened(project.id);
    await openProject(project, chooser.filePath);
    setChooser(null);
  };

  const handleChooserCreate = async (name: string) => {
    if (!chooser || creatingProject.current) return;
    creatingProject.current = true;
    try {
      setIsLoading(true);
      const project = await window.electronAPI.createProject({
        name,
        video_path: chooser.filePath,
        video_name: chooser.videoName,
        description: `Project for ${chooser.videoName}`,
      });
      await openProject(project, chooser.filePath);
      setChooser(null);
    } catch (error) {
      console.error("Error creating project:", error);
      showError(t("app.projects.chooserCreateError"));
    } finally {
      creatingProject.current = false;
      setIsLoading(false);
    }
  };

  const handleLoadVideoByPath = async (filePath: string) => {
    try {
      setIsLoading(true);
      const videoName = filePath.split("/").pop() || filePath.split("\\").pop() || "Unknown Video";

      const existing = await window.electronAPI.getProjectsByVideoPath(filePath);
      if (existing.length > 0) {
        setChooser({ filePath, videoName, projects: existing });
        return;
      }

      const project = await window.electronAPI.createProject({
        name: projectNameFor(videoName),
        video_path: filePath,
        video_name: videoName,
        description: `Project for ${videoName}`,
      });
      await openProject(project, filePath);
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

      const videos = await window.electronAPI.getProjectVideos(project.id);
      const previous = loadPref<number | null>(activeRecordingKey(project.id), null);
      let videoPathToUse = videos.find(video => video.id === previous)?.video_path ?? project.video_path;
      let projectToUse = project;

      const existence = await window.electronAPI.checkPathsExist(
        [...new Set([videoPathToUse, ...videos.map(video => video.video_path)])],
      );
      if (!existence[videoPathToUse]) {
        const located = await locateRecording(videoPathToUse);
        if (located) {
          if (videoPathToUse === project.video_path) {
            projectToUse = { ...project, video_path: located.path, video_name: located.name };
          }
          videoPathToUse = located.path;
        } else {
          // Open another game that is still on disk, so one missing file can't lock the project.
          const fallback = videos.find(video => existence[video.video_path]);
          if (!fallback) return;
          videoPathToUse = fallback.video_path;
        }
      }

      await window.electronAPI.updateProjectLastOpened(project.id);

      await openProject(projectToUse, videoPathToUse);
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

  const refreshClips = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

  const handleClipCreated = useCallback(() => {
    refreshClips();
    setShowClipCreator(false);
    handleClearMarks();
  }, [refreshClips, handleClearMarks]);

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
          ...videoPlayerRef.current?.getClipDrawings(markInTime, markOutTime),
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
        <div className={styles.layoutPresets} role="group" aria-label={t("app.layout.label")}>
          <span className={styles.layoutPresetsCaption} aria-hidden="true">{t("app.layout.label")}</span>
          {LAYOUT_PRESET_IDS.map(id => {
            const active = presetState.selected === id;
            const edited = active && presetState.edited;
            const name = t(`app.layout.${id}`);
            return (
              <button
                key={id}
                type="button"
                className={`${styles.presetBtn} ${active ? styles.presetBtnActive : ""}`}
                aria-pressed={active}
                aria-label={edited ? t("app.layout.edited", { name }) : name}
                title={edited ? t("app.layout.restoreHint", { name }) : t(`app.layout.${id}Hint`)}
                onClick={() => applyPreset(id)}
              >
                <PresetDiagram id={id} />
                <span className={styles.presetName}>{name}</span>
                {edited && <span className={styles.presetEditedMark} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
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
          <div className={styles.panelToggles}>
            <button
              type="button"
              className={`${styles.btn} ${styles.iconBtn}`}
              aria-pressed={!isSidePanelCollapsed}
              aria-label={t("app.buttons.sidePanel")}
              title={isSidePanelCollapsed ? t("app.buttons.showSidePanel") : t("app.buttons.hideSidePanel")}
              onClick={() => {
                setIsSidePanelCollapsed(!isSidePanelCollapsed);
                markLayoutEdited();
              }}
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <rect x=".7" y=".7" width="16.6" height="12.6" />
                <path d="M12 .7v12.6" />
                <path d="M12 .7h5.3v12.6H12z" fill="currentColor" fillOpacity=".35" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.iconBtn}`}
              aria-pressed={!isBottomPanelCollapsed}
              aria-label={t("app.buttons.bottomPanel")}
              title={isBottomPanelCollapsed ? t("app.buttons.showBottomPanel") : t("app.buttons.hideBottomPanel")}
              onClick={() => {
                setIsBottomPanelCollapsed(!isBottomPanelCollapsed);
                markLayoutEdited();
              }}
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <rect x=".7" y=".7" width="16.6" height="12.6" />
                <path d="M.7 9h16.6" />
                <path d="M.7 9h16.6v4.3H.7z" fill="currentColor" fillOpacity=".35" />
              </svg>
            </button>
          </div>
          {currentProject && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => { setStatsGame(null); setShowStats(true); }}
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

      <main ref={mainRef} className={styles.mainContent}>
        <div className={styles.contentWithSidePanel}>
          <div className={styles.videoContainer}>
            <div className={styles.videoSection}>
              {currentProject && (
                <div className={styles.gamePicker}>
                  <label htmlFor="project-game">{t("app.projects.gameRecording")}</label>
                  <select
                    id="project-game"
                    disabled={isLoading}
                    value={activeRecording?.id ?? ""}
                    onChange={(event) => {
                      const recording = recordings.find(video => video.id === Number(event.target.value));
                      if (recording) void switchRecording(recording);
                    }}
                  >
                    {recordings.map(video => <option key={video.id} value={video.id}>{video.video_name}</option>)}
                  </select>
                  <button type="button" className={styles.btn} onClick={handleAddRecording} disabled={isLoading}>
                    {t("app.projects.addGame")}
                  </button>
                </div>
              )}
              <VideoPlayer
                key={`${currentProject?.id}:${videoPath}:${playerReload}`}
                ref={videoPlayerRef}
                videoPath={videoPath}
                projectId={currentProject?.id}
                recordingId={activeRecording?.id}
                firstRecording={activeRecording?.id === recordings[0]?.id}
                startAt={startAt}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                markInTime={markInTime}
                markOutTime={markOutTime}
                onMarkIn={handleMarkIn}
                onMarkOut={handleMarkOut}
                onClearMarks={handleClearMarks}
                onQuickTag={handleQuickTag}
                clips={gameClips}
                onClipsUpdated={refreshClips}
                onLocate={locateActiveRecording}
                onConvert={convertActiveRecording}
                reloadToken={playerReload}
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
                    clips={gameClips}
                    categories={categories}
                    currentTime={currentTime}
                    videoDuration={duration}
                    onTimeSeek={handleTimeSeek}
                    onClipSelect={handleClipSelect}
                    listWidth={bottomListWidth}
                    onListWidthChange={onUserListWidthChange}
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
                onClipsChanged={refreshClips}
                onJumpToSource={handleClipSelect}
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
                getClipDrawings={(start, end) =>
                  videoPlayerRef.current?.getClipDrawings(start, end)
                }
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
        onRenameProject={(id, name) => {
          setCurrentProject((project: Project | null) => project?.id === id ? { ...project, name } : project);
        }}
        onCreateNew={handleCreateNewProject}
        onLoadVideoByPath={handleLoadVideoByPath}
      />

      {chooser && (
        <VideoProjectChooser
          videoName={chooser.videoName}
          defaultName={projectNameFor(chooser.videoName)}
          projects={chooser.projects}
          busy={isLoading}
          onOpen={handleChooserOpen}
          onCreate={handleChooserCreate}
          onCancel={() => setChooser(null)}
        />
      )}

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
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setShowStats(false); } }}
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
              {recordings.length > 1 && (
                <div className={styles.gamePicker}>
                  <label htmlFor="stats-game">{t("app.projects.gameRecording")}</label>
                  <select
                    id="stats-game"
                    value={statsGame ?? ""}
                    onChange={(event) => setStatsGame(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">{t("app.projects.allGames")}</option>
                    {recordings.map(video => <option key={video.id} value={video.id}>{video.video_name}</option>)}
                  </select>
                </div>
              )}
              <StatsDashboard
                clips={statsGame === null ? clips : clips.filter(clip =>
                  recordings.some(video => video.id === statsGame && isSamePath(video.video_path, clip.video_path)),
                )}
                categories={categories}
                videoDuration={statsGame === activeRecording?.id || recordings.length <= 1 ? duration : 0}
                showDistribution={statsGame !== null || recordings.length <= 1}
                recordingId={statsGame ?? undefined}
                recordings={recordings}
                projectId={currentProject?.id}
                onOpenClip={clip => {
                  if (handleClipSelect(clip)) setShowStats(false);
                  else showError(t("app.stats.openInMainVideoMissing"));
                }}
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
      <ConvertProgress />
    </div>
  );
};
