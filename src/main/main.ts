import { buildSession, parseSession, sessionFromLocal, writeSession } from "./sessionData";
import { isSamePath } from "../shared/clipDrawings";
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol } from "electron";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "crypto";
import { setupAutoUpdater, checkForUpdates } from "./autoUpdater";
import { fileRangeStream } from "./fileStream";
import { nt, setNativeLanguage } from "./nativeStrings";
import {
  setupDatabase,
  getDbStatus,
  getCategories,
  getCategoriesHierarchical,
  createCategory,
  clearProjectCategories,
  updateCategory,
  deleteCategory,
  getPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  Player,
  getAnnotations,
  createAnnotation,
  updateAnnotationTiming,
  deleteAnnotation,
  Annotation,
  AnnotationTiming,
  getClips,
  createClip,
  updateClip,
  deleteClip,
  getClipById,
  setClipDrawingsKey,
  createProject,
  getProjectsByVideoPath,
  getProjectById,
  anyUidExists,
  getProjectIdByUid,
  getProjects,
  updateProjectLastOpened,
  renameProject,
  getProjectVideos,
  addProjectVideo,
  getProjectVideoPaths,
  inProjectTransaction,
  relinkVideoPath,
  deleteProject,
  Category,
  Clip,
  Project,
  resetDatabase,
  getKeyBindings,
  setKeyBinding,
  KeyBindings,
  savePreset,
  loadPreset,
  getPresets,
  deletePreset,
  saveShareSnapshot,
  insertShareSnapshotInTransaction,
  latestReceivedShareId,
  setReceivedInPlace,
  getReceivedInPlace,
  getShareSnapshotById,
  applyShareMerge,
  getSessionSource,
} from "./database";
import { RECEIVED_VIDEO_CHANGED, assertReceivedUnchanged, checkReceivedInPlace } from "./bundleFiles";
import { MEDIA_SCHEME } from "../shared/media";
import { buildDrawingGraph, selectClipDrawings, MAX_CLIP_DRAWINGS } from "../shared/clipDrawings";
import { parseVideoLink } from "./videoLink";
import { LineBuffer, downloadOutcome, lastPrintedPath, progressPercent, templateLiteral } from "./ytdlpOutput";
import { ClipCuts } from "./clipProcesses";
import { clipFileTitle, clipInputError } from "../shared/clipInput";
import { safeFolderName } from "../shared/safeFolderName";
import { hasVideoExtension, PICKER_EXTENSIONS } from "../shared/videoPath";
import { convertArgs, parseProbe, playablePlan, progressSeconds, ProbedVideo } from "./playable";
import { isInsideDir } from "./insideDir";
import { RECORDING_ALREADY_IN_PROJECT } from "./relink";
import { removeProjectVideosDir } from "./projectVideosDir";
import { createPickedPaths } from "./pickedPaths";
import { forgetPart, recordPart, sweepParts } from "./pendingParts";
import { clipRows, clipsCsv, clipsJson } from "./clipsData";
import { zipEntries } from "./zipEntries";
import { exportFoldersFor } from "./exportGroups";
import { safeName, uniqueName } from "./bundleNames";
import { buildManifest } from "./bundleManifest";
import { fingerprintFile } from "./fingerprint";
import {
  ContentLookups, MergeShare, NewShare, PendingShare, SharedFile, ShareOperations, alreadyHave, planImportCopies,
  prepareNewImport, readSharedFile, resolveBundleContents, runImport,
} from "./shareImport";
import { diffSessions } from "./shareDiff";
import {
  MergePlan, classifyShare, copyChoice, mergeNeeds, planMerge, planMergeCopies, sessionsMatch, validateSelections,
} from "./shareMerge";
import { removeMergedFiles } from "./shareApply";
import { reviewSummary } from "./shareReview";
import {
  IMPORT_FAILED, INVALID_INPUT, REVIEW_STALE, INSUFFICIENT_SPACE, SHARE_CANCELLED, SHARE_FAILED, SHARE_FILE_MISSING, VIDEO_SOURCE,
  appError, hasFreeSpace, mapShareError, planShareCopies, runShare, statSource,
} from "./shareBundle";
import { courtSvg, CourtDot, CourtLegendItem } from "../shared/courtSvg";
import { normalizeReport, scoutingReportHtml } from "../shared/scoutingReport";
import yazl from "yazl";

// Handle Squirrel.Windows lifecycle events (install/update/uninstall). On those
// runs Squirrel launches the app with a --squirrel-* flag; this creates or
// removes shortcuts and quits immediately so the operation completes cleanly.
// Required for auto-updates to apply correctly on Windows. No-op elsewhere.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Register the custom media scheme before the app is ready. Privileged so the
// renderer can load it while webSecurity is on, but it must NOT bypass CSP — it
// only serves media bytes.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

// Helper function to fix ASAR unpacked paths
const fixAsarPath = (binaryPath: string): string => {
  // In production, binaries are in app.asar.unpacked, not app.asar
  // This is critical for Electron packaging to work correctly
  let fixedPath = binaryPath.replace("app.asar", "app.asar.unpacked");

  // Normalize and convert to forward slashes for fluent-ffmpeg
  fixedPath = path.normalize(fixedPath).replace(/\\/g, "/");

  return fixedPath;
};

const ffmpegPath = path.join(
  app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), "out", "ffmpeg"),
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
);
ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow: BrowserWindow;

const SOURCE_URL = "https://github.com/kauredo/basketball-video-analyzer";

// The About panel carries the notices AGPL section 5(d) asks an interactive
// program to show. macOS shows copyright and credits, Linux shows copyright,
// authors and website, Windows shows copyright and credits.
const setAboutPanel = (): void => {
  app.setAboutPanelOptions({
    applicationName: "Basketball Video Analyzer",
    applicationVersion: app.getVersion(),
    copyright:
      "Copyright (C) 2026 Vasco Kaufmann. Free software under the GNU Affero General Public License, version 3 or later. It comes with ABSOLUTELY NO WARRANTY.",
    credits: `Source code: ${SOURCE_URL}`,
    authors: ["Vasco Kaufmann"],
    website: SOURCE_URL,
  });
};

// Packaging puts LICENSE and THIRD-PARTY-NOTICES.txt in the resources folder.
const openLicenses = async (): Promise<void> => {
  const notices = path.join(process.resourcesPath, "THIRD-PARTY-NOTICES.txt");
  if (app.isPackaged && fs.existsSync(notices)) {
    await shell.openPath(notices);
  } else {
    await shell.openExternal(`${SOURCE_URL}/blob/main/LICENSE`);
  }
};

// Track active clip creation processes
const clipCuts = new ClipCuts();

const createMenu = (mainWindow: BrowserWindow): void => {
  const isMac = process.platform === "darwin";

  const template: any[] = [
    // App menu (Mac only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: nt("checkForUpdates"),
                click: () => checkForUpdates(mainWindow),
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: nt("file"),
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    // Edit menu
    {
      label: nt("edit"),
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    // View menu
    {
      label: nt("view"),
      submenu: [
        // A reload mid-session drops unsaved work, so coaches don't get it.
        ...(app.isPackaged
          ? []
          : [
              { role: "reload" },
              { role: "forceReload" },
              { role: "toggleDevTools" },
              { type: "separator" },
            ]),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // Help menu
    {
      label: nt("help"),
      submenu: [
        ...(!isMac
          ? [
              {
                label: nt("checkForUpdates"),
                click: () => checkForUpdates(mainWindow),
              },
              { type: "separator" },
            ]
          : []),
        {
          label: nt("sendFeedback"),
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("open-feedback");
            }
          },
        },
        { type: "separator" },
        {
          label: nt("learnMore"),
          click: async () => {
            await shell.openExternal(SOURCE_URL);
          },
        },
        { label: nt("licenses"), click: openLicenses },
        // macOS has About in the app menu.
        ...(!isMac ? [{ role: "about" }] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 1000,
    width: 1600,
    // The workspace stacks a film pane, control bands and two panels. Below
    // 1280 wide the header title wraps and its buttons spill out of the 60px
    // bar over the video; below 700 tall the film pane hits its floor and the
    // clip list is squeezed to its own.
    minHeight: 700,
    minWidth: 1280,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "default",
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // Setup auto-updater after window is ready
    setupAutoUpdater(mainWindow);
  });

  mainWindow.on("closed", () => {
    app.quit();
  });

  // Create application menu with "Check for Updates" option
  createMenu(mainWindow);
};

// Get clips directory in app's userData folder (always accessible, no perms).
const getClipsDirectory = () => path.join(app.getPath("userData"), "clips");

const getDownloadsDirectory = () => path.join(app.getPath("userData"), "downloads");

// Content types for media served over the custom scheme.
const MEDIA_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const mediaContentType = (filePath: string): string =>
  MEDIA_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ||
  "application/octet-stream";

// Resolved real paths already cleared for serving, cached so scrubbing a source
// video (which fires many Range requests) doesn't re-query the DB each time.
const allowedMediaPaths = new Set<string>();

// Only serve files the app legitimately references: generated clips/thumbnails
// (clips dir), downloaded videos (downloads dir), or a source video registered
// as a project. Everything else is rejected to prevent arbitrary file reads.
// `resolved` is expected to already be a realpath (symlinks resolved).
// A recording used in place from a received folder can still be changed by
// its sender, so every read of one checks it first.
const assertReceived = (file: string): void => assertReceivedUnchanged(path.resolve(file), getReceivedInPlace);

const isAllowedMediaPath = (resolved: string): boolean => {
  if (allowedMediaPaths.has(resolved)) return true;

  // Compare against the real path of each base dir so a symlinked userData
  // (or /var -> /private/var on macOS) doesn't cause false negatives.
  const realDir = (dir: string) => {
    try {
      return fs.realpathSync(path.resolve(dir));
    } catch {
      return path.resolve(dir);
    }
  };
  const within = (dir: string) => {
    const base = realDir(dir);
    return resolved === base || resolved.startsWith(base + path.sep);
  };

  let allowed = within(getClipsDirectory()) || within(getDownloadsDirectory());
  if (!allowed) {
    try {
      allowed = getProjectVideoPaths().some((videoPath) => {
        // Never through a link: a sender could point one anywhere.
        const received = getReceivedInPlace(videoPath);
        if (received) return videoPath === resolved && checkReceivedInPlace(resolved, received).ok;
        try {
          return fs.realpathSync(path.resolve(videoPath)) === resolved;
        } catch {
          return path.resolve(videoPath) === resolved;
        }
      });
    } catch (error) {
      console.error("Error validating media path:", error);
      return false;
    }
  }
  if (allowed) allowedMediaPaths.add(resolved);
  return allowed;
};

app.whenReady().then(() => {
  setupDatabase();
  try {
    const swept = sweepParts(pendingPartsFile());
    if (swept.length > 0) console.log("Removed partial copies left by the last run:", swept);
  } catch (error) {
    console.warn("Couldn't sweep partial copies:", error);
  }
  setAboutPanel();

  // Serve local media through the validated custom scheme. We handle Range
  // requests explicitly (206 + Content-Range) so <video> can seek — Electron's
  // net.fetch on file:// does not reliably honour Range, which made scrubbing
  // snap back to the start.
  protocol.handle(MEDIA_SCHEME, (request) => {
    try {
      const requested = new URL(request.url).searchParams.get("path");
      if (!requested) {
        return new Response("Missing path", { status: 400 });
      }
      // Resolve symlinks so a link planted inside an allowed dir can't escape it.
      let resolved = path.resolve(requested);
      try {
        resolved = fs.realpathSync(resolved);
      } catch {
        // File may not exist; the statSync below will 404.
      }
      try {
        assertReceived(requested);
        assertReceived(resolved);
      } catch {
        return new Response("Forbidden", { status: 403 });
      }
      if (!isAllowedMediaPath(resolved)) {
        console.warn("Blocked media request for disallowed path:", resolved);
        return new Response("Forbidden", { status: 403 });
      }

      let size: number;
      try {
        size = fs.statSync(resolved).size;
      } catch {
        return new Response("Not found", { status: 404 });
      }
      const contentType = mediaContentType(resolved);

      const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(
        (request.headers.get("range") || "").trim(),
      );
      if (rangeMatch) {
        let start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
        let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : size - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= size) end = size - 1;
        if (start > end || start >= size) {
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        }
        return new Response(fileRangeStream(resolved, start, end), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      return new Response(fileRangeStream(resolved, 0, size - 1), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error("Error serving media:", error);
      return new Response("Internal error", { status: 500 });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Pre-flight system checks
ipcMain.handle("system-check", async () => {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    // Check FFmpeg availability
    if (!fs.existsSync(ffmpegPath)) {
      issues.push("ERROR_FFMPEG_NOT_FOUND");
    }

    // Check clips directory access
    const clipsDir = getClipsDirectory();
    const userDataDir = app.getPath("userData");

    try {
      if (!fs.existsSync(userDataDir)) {
        issues.push("ERROR_USER_DATA_NOT_ACCESSIBLE");
      } else {
        // Test write access
        const testFile = path.join(userDataDir, ".test-write");
        try {
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);
        } catch {
          issues.push("ERROR_NO_WRITE_ACCESS");
        }
      }
    } catch (error) {
      issues.push("ERROR_USER_DATA_NOT_ACCESSIBLE");
    }

    // Check available disk space (if possible)
    try {
      if (process.platform !== "win32" && fs.existsSync(userDataDir)) {
        const stats = require("fs").statfsSync(userDataDir);
        const freeSpaceGB = stats.free / (1024 * 1024 * 1024);
        if (freeSpaceGB < 1) {
          warnings.push("WARNING_LOW_DISK_SPACE");
        }
      }
    } catch (error) {
      console.warn("Could not check disk space:", error);
    }

    return {
      success: issues.length === 0,
      issues,
      warnings,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        ffmpegPath,
        clipsDirectory: clipsDir,
      },
    };
  } catch (error) {
    console.error("System check error:", error);
    return {
      success: false,
      issues: ["ERROR_SYSTEM_CHECK_FAILED"],
      warnings: [],
      system: null,
    };
  }
});

// Cancel clip creation
ipcMain.handle("cancel-clip-creation", async (_event, processId: string) => {
  try {
    if (clipCuts.cancel(processId)) {
      return { success: true };
    }
    return { success: false, reason: "Process not found" };
  } catch (error) {
    console.error("Error cancelling clip creation:", error);
    return { success: false, reason: "Cancel failed" };
  }
});

// Video file operations
const selectVideoFile = async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Videos",
          extensions: PICKER_EXTENSIONS,
        },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return await ensurePlayable(result.filePaths[0]);
    }
    return null;
  } catch (error) {
    console.error("Error selecting video file:", error);
    return null;
  }
};

// Locate video relinks only to a file this picker returned.
const pickedVideos = createPickedPaths(10 * 60_000);

ipcMain.handle("select-video-file", async () => {
  const file = await selectVideoFile();
  if (file) pickedVideos.remember(file);
  return file;
});

ipcMain.handle("get-project-videos", (_event, id: number) =>
  Number.isSafeInteger(id) && id > 0 ? getProjectVideos(id) : []);

ipcMain.handle("add-project-video", async (_event, id: number) => {
  if (!Number.isSafeInteger(id) || id < 1 || !getProjectById(id)) return null;
  const file = await selectVideoFile();
  if (!file || !isVideoFile(file) || !getProjectById(id)) return null;
  return addProjectVideo(id, file, path.basename(file));
});

// The player's "Make a playable copy" button, for a project video it refused.
// The copy goes through relink-video-path like a located file.
ipcMain.handle("convert-project-video", async (_event, videoPath: unknown) => {
  if (typeof videoPath !== "string" || !getProjectVideoPaths().includes(videoPath) || !fs.existsSync(videoPath)) {
    return null;
  }
  const copy = await ensurePlayable(videoPath, true);
  if (copy) pickedVideos.remember(copy);
  return copy;
});

// Why a recording didn't play: the media scheme can only answer 403.
ipcMain.handle("received-video-changed", (_event, videoPath: unknown) => {
  if (typeof videoPath !== "string" || videoPath.length === 0) return false;
  try {
    assertReceived(videoPath);
    return false;
  } catch {
    return true;
  }
});

ipcMain.handle("check-paths-exist", async (_event, paths: string[]) => {
  const result: Record<string, boolean> = {};
  for (const p of paths) {
    try {
      result[p] = typeof p === "string" && p.length > 0 && fs.existsSync(p);
    } catch {
      result[p] = false;
    }
  }
  return result;
});

// Largest overlay PNG we'll accept from the renderer (decoded bytes). A 4K
// drawing is well under this; the cap just bounds a malformed/oversized payload.
const MAX_OVERLAY_BYTES = 64 * 1024 * 1024;
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

const tempPngPath = () =>
  path.join(app.getPath("temp"), `telestration-${randomUUID().slice(0, 8)}.png`);

// Decode a base64 PNG data URL to overlayPath and return the path. Rejects
// anything that isn't a PNG data URL or exceeds the size cap.
const writePngDataUrl = (overlayImage: string, overlayPath: string): string => {
  if (!overlayImage.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error("ERROR_INVALID_OVERLAY");
  }
  const buffer = Buffer.from(
    overlayImage.slice(PNG_DATA_URL_PREFIX.length),
    "base64"
  );
  if (buffer.length === 0 || buffer.length > MAX_OVERLAY_BYTES) {
    throw new Error("ERROR_INVALID_OVERLAY");
  }
  fs.writeFileSync(overlayPath, buffer);
  return overlayPath;
};

// Every ffmpeg input reads plain files only, so a crafted container (an HLS
// playlist renamed .mp4, say) can't fetch URLs or pull in other local files.
const FILE_INPUT_ONLY = ["-protocol_whitelist", "file"];

// ffmpeg prints the input's streams before complaining there is no output,
// which is the only stream probe available now ffprobe isn't bundled.
const hasAudioStream = (inputPath: string): Promise<boolean> =>
  new Promise(resolve => {
    assertReceived(inputPath);
    let stderr = "";
    const probe = spawn(ffmpegPath, ["-hide_banner", ...FILE_INPUT_ONLY, "-i", inputPath]);
    probe.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
    probe.on("close", () => resolve(/Stream #\d+:\d+.*: Audio:/.test(stderr)));
    probe.on("error", () => resolve(false));
  });

const probeVideo = (inputPath: string): Promise<ProbedVideo | null> =>
  new Promise(resolve => {
    let stderr = "";
    const probe = spawn(ffmpegPath, ["-hide_banner", ...FILE_INPUT_ONLY, "-i", inputPath]);
    probe.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
    probe.on("close", () => resolve(stderr.includes("Input #0") ? parseProbe(stderr) : null));
    probe.on("error", () => resolve(null));
  });

// The one playable copy being written, so Cancel and quitting can stop it.
let conversion: { process: ChildProcess; cancelled: boolean } | null = null;

// Closing the window quits the app while ffmpeg may still report, so the
// window can be gone here.
type ConvertProgress = { name: string; percent: number | null; seconds: number };

const pendingPartsFile = () => path.join(app.getPath("userData"), "pending-copies.json");

// Copies made this run, by the file they were made from.
const copiedFrom = new Map<string, string>();

// The list only serves the next launch's sweep, so failing to write it never
// stops or hangs a copy.
const trackPart = (track: (listFile: string, part: string) => void, part: string) => {
  try {
    track(pendingPartsFile(), part);
  } catch (error) {
    console.warn("Couldn't update the list of partial copies:", error);
  }
};

const sendConvertProgress = (progress: ConvertProgress | null) => {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("convert-progress", progress);
  }
};

const runConversion = (inputPath: string, outputPath: string, args: string[], duration: number | null) =>
  new Promise<"done" | "cancelled">((resolve, reject) => {
    const part = `${outputPath}.${randomUUID().slice(0, 8)}.part`;
    const name = path.basename(inputPath);
    trackPart(recordPart, part);
    const child = spawn(ffmpegPath, ["-hide_banner", "-nostdin", "-y", ...FILE_INPUT_ONLY, "-i", inputPath, ...args, part]);
    const current = { process: child, cancelled: false };
    conversion = current;
    let tail = "";
    let pending = "";
    // Without a duration there is no percent, so the overlay shows the time written.
    let percent: number | null = duration ? 0 : null;
    let shownSeconds = 0;
    sendConvertProgress({ name, percent, seconds: 0 });
    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      tail = (tail + text).slice(-2000);
      // ffmpeg ends progress lines with \r, and a chunk can stop mid-number.
      const lines = (pending + text).split(/[\r\n]/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const seconds = progressSeconds(line);
        if (seconds === null) continue;
        if (!duration) {
          if (seconds >= shownSeconds + 1) {
            shownSeconds = Math.floor(seconds);
            sendConvertProgress({ name, percent: null, seconds: shownSeconds });
          }
          continue;
        }
        const next = Math.min(99, Math.round((seconds / duration) * 100));
        if (percent !== null && next > percent) {
          percent = next;
          sendConvertProgress({ name, percent, seconds });
        }
      }
    });
    let settled = false;
    const finish = (error: Error | null) => {
      // A spawn error is followed by close, so this can be called twice.
      if (settled) return;
      settled = true;
      if (conversion === current) conversion = null;
      sendConvertProgress(null);
      if (!error) {
        try {
          fs.renameSync(part, outputPath);
          trackPart(forgetPart, part);
          resolve("done");
          return;
        } catch (renameError) {
          error = renameError as Error;
        }
      }
      deleteTempFile(part);
      trackPart(forgetPart, part);
      if (current.cancelled) resolve("cancelled");
      else reject(error);
    };
    child.on("error", finish);
    child.on("close", code => {
      const lastLine = tail.trim().split("\n").pop() ?? "";
      finish(code === 0 ? null : new Error(lastLine || `ffmpeg exited with ${code}`));
    });
  });

const cancelConversion = () => {
  if (!conversion) return;
  conversion.cancelled = true;
  conversion.process.kill("SIGKILL");
};

ipcMain.handle("cancel-convert", () => cancelConversion());

/**
 * The file to use for a video the coach picked: the file itself when the
 * player opens it, or an MP4 copy the app makes after asking. Null when the
 * coach says no or the copy fails. The original is never changed. `force` is
 * for a file the player refused: one whose format should play is re-encoded.
 */
let converting = false;

const ensurePlayable = async (inputPath: string, force = false): Promise<string | null> => {
  // Claimed before the first await, so a second call can't get past the dialogs too.
  if (converting) return null;
  converting = true;
  try {
    return await planAndConvert(inputPath, force);
  } finally {
    converting = false;
  }
};

const planAndConvert = async (inputPath: string, force: boolean): Promise<string | null> => {
  assertReceived(inputPath);
  const probe = await probeVideo(inputPath);
  // Without a probe there is nothing to plan from, so the player gets to try.
  if (!probe && !force) return inputPath;
  if (!probe) {
    await dialog.showMessageBox(mainWindow, {
      type: "error", message: nt("convertFailedTitle"), detail: nt("convertNoProbe"), buttons: [nt("ok")],
    });
    return null;
  }
  let plan = playablePlan(probe);
  if (plan.kind === "plays" && force) plan = playablePlan(probe, true);
  if (plan.kind === "plays") return inputPath;
  const name = path.basename(inputPath);
  if (plan.kind === "no-video") {
    await dialog.showMessageBox(mainWindow, {
      type: "warning", message: nt("convertNoVideo", { name }), buttons: [nt("ok")],
    });
    return null;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    message: nt("convertMessage", { name }),
    detail: nt(plan.video === "copy" ? "convertDetailCopy" : "convertDetailEncode"),
    buttons: [nt("convertConfirm"), nt("cancel")],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return null;
  const base = path.join(path.dirname(inputPath), path.parse(inputPath).name);
  const suggested = fs.existsSync(`${base}.mp4`) ? `${base} (${nt("convertSuffix")}).mp4` : `${base}.mp4`;
  const saved = await dialog.showSaveDialog(mainWindow, {
    title: nt("convertSaveTitle"),
    defaultPath: suggested,
    filters: [{ name: "MP4", extensions: ["mp4"] }],
  });
  if (saved.canceled || !saved.filePath) return null;
  const outputPath = saved.filePath.toLowerCase().endsWith(".mp4") ? saved.filePath : `${saved.filePath}.mp4`;
  // The dialog only asked about overwriting the name as typed, without .mp4.
  if (isSamePath(outputPath, inputPath) ||
    (outputPath !== saved.filePath && fs.existsSync(outputPath)) ||
    getProjectVideoPaths().some(videoPath => isSamePath(videoPath, outputPath))) {
    await dialog.showMessageBox(mainWindow, {
      type: "warning", message: nt("convertFailedTitle"), detail: nt("convertSameFile"), buttons: [nt("ok")],
    });
    return null;
  }
  try {
    // The dialogs can stay open for minutes, and a received file can change meanwhile.
    assertReceived(inputPath);
    const result = await runConversion(inputPath, outputPath, convertArgs(plan, probe.video ?? ""), probe.durationSeconds);
    if (result !== "done") return null;
    copiedFrom.set(outputPath, inputPath);
    return outputPath;
  } catch (error) {
    console.error("Error making a playable copy:", error);
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      message: nt("convertFailedTitle"),
      detail: error instanceof Error ? error.message : String(error),
      buttons: [nt("ok")],
    });
    return null;
  }
};

// Best-effort removal of a temp file.
const deleteTempFile = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // best-effort temp cleanup
  }
};

// A cut that never reaches the database leaves nothing that lists or deletes
// its files later, so they go now.
const removeClipFiles = (...paths: Array<string | null>): void => {
  for (const filePath of paths) {
    if (filePath) deleteTempFile(filePath);
  }
};

// A project's video path comes from the renderer and later passes the media
// allowlist, so it has to be an existing video file.
const isVideoFile = (filePath: unknown): boolean => {
  if (!hasVideoExtension(filePath)) return false;
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

// Normalized path of a source video the app may read, or null. Symlinks are
// resolved before the allowlist check so a link can't point outside it.
const allowedInputPath = (inputPath: unknown): string | null => {
  if (typeof inputPath !== "string" || inputPath.length === 0) return null;
  const normalized = path.normalize(inputPath);
  let resolved = path.resolve(normalized);
  try {
    resolved = fs.realpathSync(resolved);
  } catch {
    // Falls through to the existence check below.
  }
  assertReceived(normalized);
  assertReceived(resolved);
  return isAllowedMediaPath(resolved) && fs.existsSync(normalized) ? normalized : null;
};

// Save a single annotated frame: extract the frame at `time` from the source
// video and composite the drawing (a native-resolution transparent PNG) on top.
// Compositing happens here via ffmpeg so the renderer never has to draw the
// video onto a canvas (which would taint it and block toDataURL).
ipcMain.handle(
  "export-annotated-frame",
  async (
    _event,
    params: { inputPath: string; time: number; overlayImage: string }
  ) => {
    const { inputPath, time, overlayImage } = params;
    if (!Number.isFinite(time) || time < 0) {
      throw new Error("ERROR_INVALID_TIME");
    }
    const normalizedInputPath = allowedInputPath(inputPath);
    if (!normalizedInputPath) {
      throw new Error("ERROR_FILE_NOT_FOUND");
    }

    const baseName = path
      .basename(normalizedInputPath)
      .replace(/\.[^/.]+$/, "");
    const defaultName = `${baseName}_annotated_${Math.round(time)}s.png`;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath("documents"), defaultName),
      filters: [
        { name: "PNG Image", extensions: ["png"] },
        { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    const outputPath = result.filePath;
    // The save dialog can stay open for a while.
    assertReceived(normalizedInputPath);

    const overlayPath = writePngDataUrl(overlayImage, tempPngPath());

    return new Promise((resolve, reject) => {
      ffmpeg(normalizedInputPath.replace(/\\/g, "/"))
        .inputOptions(FILE_INPUT_ONLY)
        .seekInput(time)
        .input(overlayPath.replace(/\\/g, "/"))
        .inputOptions(FILE_INPUT_ONLY)
        .complexFilter(["[0:v][1:v]overlay=0:0[outv]"])
        .outputOptions(["-map", "[outv]", "-frames:v", "1", "-y"])
        .output(outputPath.replace(/\\/g, "/"))
        .on("end", () => {
          deleteTempFile(overlayPath);
          resolve({ filePath: outputPath });
        })
        .on("error", err => {
          deleteTempFile(overlayPath);
          console.error("Error exporting annotated frame:", err);
          reject(new Error("ERROR_EXPORT_FAILED"));
        })
        .run();
    });
  }
);

interface EncodeClipOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  duration: number;
  drawings: Array<{ image: string; timestamp: number; seconds: number; pause: boolean }>;
  overlayPath: string | null;
  onStart?: (command: ffmpeg.FfmpegCommand) => void;
  onProgress?: (percent: number, timemark: string) => void;
}

// Cut [startTime, startTime + duration) of the source into outputPath, burning
// in saved drawings at their moments and the creation-time overlay throughout.
const encodeClip = async ({
  inputPath,
  outputPath,
  startTime,
  duration,
  drawings,
  overlayPath,
  onStart,
  onProgress,
}: EncodeClipOptions): Promise<void> => {
  const selected = selectClipDrawings(startTime, duration, drawings);
  const hasAudio = selected.some(d => d.pause) && (await hasAudioStream(inputPath));
  assertReceived(inputPath);
  return new Promise((resolve, reject) => {
    const clipDrawings = selected.flatMap(d => {
      try {
        return [{ ...d, path: writePngDataUrl(d.image, tempPngPath()) }];
      } catch (drawingError) {
        console.error("Skipping clip drawing:", drawingError);
        return [];
      }
    });
    const cleanup = () => clipDrawings.forEach(d => deleteTempFile(d.path));

    try {
      const videoOutputOptions = [
        "-y", // Overwrite output files
        "-movflags",
        "+faststart", // Optimize for web playback - allows video to start playing before fully downloaded
        "-c:v",
        "libx264", // Use H.264 codec for broad compatibility
        "-preset",
        "veryfast", // Best speed/quality balance (faster than medium with similar quality)
        "-crf",
        "23", // Constant Rate Factor: 18-28 range, 23 is good balance (lower = better quality)
        "-c:a",
        "aac", // Use AAC audio codec for broad compatibility
        "-b:a",
        "128k", // Audio bitrate - good quality for basketball commentary/court sounds
        "-ar",
        "44100", // Audio sample rate - standard for video
      ];

      const clipCommand = ffmpeg(inputPath).inputOptions(FILE_INPUT_ONLY);
      let addedSeconds = 0;

      if (clipDrawings.length > 0) {
        // -t goes on the input here: freezes make the output longer
        // than the source range.
        clipCommand.inputOptions(["-ss", String(startTime), "-t", String(duration)]);
        clipDrawings.forEach(d => clipCommand.input(d.path).inputOptions(FILE_INPUT_ONLY));
        if (overlayPath) clipCommand.input(overlayPath).inputOptions(FILE_INPUT_ONLY);
        const graph = buildDrawingGraph(
          duration,
          clipDrawings,
          1,
          hasAudio,
          overlayPath ? clipDrawings.length + 1 : undefined
        );
        addedSeconds = graph.addedSeconds;
        clipCommand.complexFilter(graph.filters).outputOptions([
          "-map",
          `[${graph.videoOut}]`,
          ...(graph.audioMap ? ["-map", graph.audioMap] : []),
          ...videoOutputOptions,
        ]);
      } else if (overlayPath) {
        // overlay's default eof_action=repeat keeps the PNG up for the whole clip.
        clipCommand.setStartTime(startTime).setDuration(duration);
        clipCommand
          .input(overlayPath)
          .inputOptions(FILE_INPUT_ONLY)
          .complexFilter(["[0:v][1:v]overlay=0:0[outv]"])
          .outputOptions(["-map", "[outv]", "-map", "0:a?", ...videoOutputOptions]);
      } else {
        clipCommand.setStartTime(startTime).setDuration(duration);
        clipCommand.outputOptions(videoOutputOptions);
      }

      clipCommand
        .output(outputPath)
        .on("start", commandLine => {
          console.log("Clip FFmpeg command:", commandLine);
          onStart?.(clipCommand);
        })
        .on("end", () => {
          cleanup();
          resolve();
        })
        .on("error", error => {
          cleanup();
          reject(error);
        })
        // Read progress from ffmpeg's own "time=" output. A "progress"
        // listener makes fluent-ffmpeg spawn ffprobe, which isn't bundled.
        .on("stderr", (line: string) => {
          if (!onProgress) return;
          const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
          if (!match) return;
          const elapsed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          onProgress(
            Math.min(100, (elapsed / (duration + addedSeconds)) * 100),
            `${match[1]}:${match[2]}:${match[3]}`
          );
        })
        .run();
    } catch (error) {
      // A throw here means ffmpeg never started, so neither handler ran.
      cleanup();
      reject(error);
    }
  });
};

ipcMain.handle(
  "cut-video-clip",
  async (
    _event,
    params: {
      inputPath: string;
      startTime: number;
      endTime: number;
      title: string;
      categories: number[];
      players?: number[];
      quarter?: string | null;
      courtX?: number | null;
      courtY?: number | null;
      notes?: string;
      projectId: number;
      overlayImage?: string;
      drawings?: Array<{
        image: string;
        timestamp: number;
        seconds: number;
        pause: boolean;
      }>;
      drawingsKey?: string;
    }
  ) => {
    return new Promise((resolve, reject) => {
      try {
        const {
          inputPath,
          startTime,
          endTime,
          title,
          categories,
          players,
          quarter,
          courtX,
          courtY,
          notes,
          projectId,
          overlayImage,
          drawings,
          drawingsKey,
        } = params;

        const inputError = clipInputError(startTime, endTime, title);
        if (inputError) {
          console.error("Invalid clip input:", inputError, { startTime, endTime });
          reject(new Error(inputError));
          return;
        }

        // Use native path separators for file system operations
        const normalizedInputPath = allowedInputPath(inputPath);
        if (!normalizedInputPath) {
          console.error("Input file is missing or not allowed:", inputPath);
          reject(new Error("ERROR_FILE_NOT_FOUND"));
          return;
        }
        const clipsDir = getClipsDirectory();
        const normalizedClipsDir = path.normalize(clipsDir);

        // Ensure clips directory exists with proper permissions
        if (!fs.existsSync(normalizedClipsDir)) {
          try {
            fs.mkdirSync(normalizedClipsDir, { recursive: true, mode: 0o755 });
          } catch (err) {
            const error = err as Error;
            console.error("Error creating clips directory:", error);
            reject(new Error("ERROR_NO_WRITE_ACCESS"));
            return;
          }
        }

        // Generate unique filename with Windows-safe characters
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const clipId = randomUUID().slice(0, 8);
        const safeTitle = clipFileTitle(title);
        const outputFileName = `${safeTitle}_${timestamp}_${clipId}.mp4`;
        const thumbnailFileName = `${safeTitle}_${timestamp}_${clipId}_thumb.jpg`;
        const outputPath = path.join(normalizedClipsDir, outputFileName);
        const thumbnailPath = path.join(normalizedClipsDir, thumbnailFileName);

        // FFmpeg (via fluent-ffmpeg) requires forward slashes on all platforms
        // The library handles path conversion internally but needs forward slash input
        const ffmpegInputPath = normalizedInputPath.replace(/\\/g, "/");
        const ffmpegOutputPath = outputPath.replace(/\\/g, "/");
        const ffmpegThumbnailPath = thumbnailPath.replace(/\\/g, "/");

        const duration = endTime - startTime;

        if (!categories || categories.length === 0) {
          console.error("No categories provided");
          reject(new Error("ERROR_NO_CATEGORIES"));
          return;
        }

        // Check if we have write access to the clips directory
        try {
          fs.accessSync(normalizedClipsDir, fs.constants.W_OK);
        } catch (error) {
          console.error("No write access to clips directory:", error);
          reject(new Error("ERROR_NO_WRITE_ACCESS"));
          return;
        }

        // Check if there's enough disk space (rough estimate - 2x input file size)
        try {
          const inputStats = fs.statSync(normalizedInputPath);
          const estimatedSize = inputStats.size * 2; // Conservative estimate

          // Skip disk space check on Windows for now as it's complex
          if (process.platform !== "win32") {
            const { free } = require("fs").statfsSync(normalizedClipsDir);
            if (free < estimatedSize) {
              reject(new Error("ERROR_INSUFFICIENT_SPACE"));
              return;
            }
          }
        } catch (error) {
          console.warn("Could not check disk space:", error);
          // Continue anyway, FFmpeg will fail if there's not enough space
        }

        console.log("Starting clip creation process...");
        console.log("Platform:", process.platform);
        console.log("Input path (native):", normalizedInputPath);
        console.log("Input path (FFmpeg):", ffmpegInputPath);
        console.log("Output path (native):", outputPath);
        console.log("Output path (FFmpeg):", ffmpegOutputPath);
        console.log("Thumbnail path (native):", thumbnailPath);
        console.log("Thumbnail path (FFmpeg):", ffmpegThumbnailPath);

        console.log("Using the globally configured FFmpeg path");

        // Generate process ID for cancellation support
        const processId = randomUUID().slice(0, 8);
        clipCuts.start(processId);
        mainWindow.webContents.send("clip-process-id", { processId });

        // First, generate the thumbnail
        const thumbnailCommand = ffmpeg(ffmpegInputPath).inputOptions(FILE_INPUT_ONLY);

        thumbnailCommand
          .setStartTime(startTime)
          .frames(1)
          .outputOptions([
            "-y", // Overwrite output files
            "-q:v",
            "2", // JPEG quality: 2-5 is high quality (1 is best, 31 is worst)
          ])
          .size("320x?") // 320px width, auto height to maintain aspect ratio
          .output(ffmpegThumbnailPath)
          .on("start", commandLine => {
            console.log("Thumbnail FFmpeg command:", commandLine);
            // Store the thumbnail process for potential cancellation
            clipCuts.track(processId, "thumb", thumbnailCommand);
          })
          .on("error", error => {
            console.error("Thumbnail creation error:", error);
            console.error("Thumbnail error message:", error.message);
            console.error("FFmpeg input path:", ffmpegInputPath);
            console.error("FFmpeg thumbnail path:", ffmpegThumbnailPath);
            clipCuts.finish(processId);
            removeClipFiles(thumbnailPath);
            reject(new Error("ERROR_THUMBNAIL_FAILED"));
          })
          .on("end", async () => {
            clipCuts.untrack(processId, "thumb");
            if (clipCuts.isCancelled(processId)) {
              clipCuts.finish(processId);
              removeClipFiles(thumbnailPath);
              reject(new Error("ERROR_CLIP_CANCELLED"));
              return;
            }
            console.log("Thumbnail created successfully");
            // The live drawing on screen at creation covers the whole clip.
            // It is kept next to the clip so a re-cut can burn it in again.
            let overlayPath: string | null = null;
            if (overlayImage) {
              try {
                overlayPath = writePngDataUrl(
                  overlayImage,
                  outputPath.replace(/\.mp4$/, "_overlay.png")
                );
              } catch (overlayError) {
                // A bad overlay shouldn't fail the whole clip — just skip it.
                console.error("Skipping clip overlay:", overlayError);
              }
            }

            console.log("Starting clip creation...");
            encodeClip({
              inputPath: ffmpegInputPath,
              outputPath: ffmpegOutputPath,
              startTime,
              duration,
              drawings: drawings ?? [],
              overlayPath,
              onStart: command => clipCuts.track(processId, "encode", command),
              onProgress: (percent, timemark) =>
                mainWindow.webContents.send("clip-progress", { percent, timemark }),
            })
              .then(() => {
                const cancelled = clipCuts.isCancelled(processId);
                clipCuts.finish(processId);
                if (cancelled) {
                  removeClipFiles(outputPath, thumbnailPath, overlayPath);
                  reject(new Error("ERROR_CLIP_CANCELLED"));
                  return;
                }
                try {
                  console.log("Clip created successfully");
                  // Save clip to database with thumbnail path
                  const clipData = {
                    project_id: projectId,
                    video_path: normalizedInputPath,
                    output_path: outputPath,
                    thumbnail_path: thumbnailPath,
                    start_time: startTime,
                    end_time: endTime,
                    duration: duration,
                    title: title,
                    categories: JSON.stringify(categories),
                    players: JSON.stringify(players || []),
                    quarter: quarter || null,
                    court_x: courtX ?? null,
                    court_y: courtY ?? null,
                    notes: notes,
                    drawings_key: drawingsKey ?? null,
                    overlay_path: overlayPath,
                  };

                  const savedClip = createClip(clipData);
                  mainWindow.webContents.send("clip-created", savedClip);
                  resolve({
                    success: true,
                    clip: savedClip,
                    outputPath: outputPath,
                    thumbnailPath: thumbnailPath,
                  });
                } catch (dbError) {
                  console.error("Database error:", dbError);
                  removeClipFiles(outputPath, thumbnailPath, overlayPath);
                  reject(new Error("ERROR_DATABASE_FAILED"));
                }
              })
              .catch(error => {
                // Cancel kills ffmpeg mid-encode, which lands here as an error.
                const cancelled = clipCuts.isCancelled(processId);
                clipCuts.finish(processId);
                removeClipFiles(outputPath, thumbnailPath, overlayPath);
                if (cancelled) {
                  reject(new Error("ERROR_CLIP_CANCELLED"));
                  return;
                }
                console.error("FFmpeg clip creation error:", error);
                console.error("Error stack:", error.stack);
                console.error("Input path:", normalizedInputPath);
                console.error("Output path:", outputPath);
                console.error("Start time:", startTime);
                console.error("Duration:", duration);
                reject(new Error(error.message === RECEIVED_VIDEO_CHANGED ? RECEIVED_VIDEO_CHANGED : "ERROR_FFMPEG_FAILED"));
              });
          })
          .run();
      } catch (error) {
        console.error("Error cutting video clip:", error);
        reject(error);
      }
    });
  }
);

ipcMain.handle("open-clip-folder", async () => {
  try {
    const clipsDir = getClipsDirectory();
    // Use openPath to open the directory directly (works on all platforms)
    if (fs.existsSync(clipsDir)) {
      shell.openPath(clipsDir);
    } else {
      // If clips dir doesn't exist, try to open parent folder
      const parentDir = path.dirname(clipsDir);
      if (fs.existsSync(parentDir)) {
        shell.openPath(parentDir);
      } else {
        // Fallback to Documents folder
        shell.openPath(app.getPath("documents"));
      }
    }
  } catch (error) {
    console.error("Error opening clip folder:", error);
  }
});

ipcMain.handle(
  "export-clips-by-category",
  async (
    _event,
    params: {
      categoryIds: number[];
      clips: Array<{
        id: number;
        title: string;
        output_path: string;
        categories: string;
      }>;
    }
  ) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "Select Export Directory",
      });

      if (result.canceled || !result.filePaths.length) {
        return null;
      }

      const exportDir = result.filePaths[0];
      const exportedFiles: string[] = [];

      // Paths and titles come from the database, never from the renderer.
      const categoryIds = [...new Set(params.categoryIds)];
      const storedClips = [...new Set(params.clips.map(clip => clip.id))]
        .map(id => getClipById(id))
        .filter((clip): clip is NonNullable<typeof clip> => !!clip);

      // Get project ID from the first clip (all clips should be from same project)
      const clipData = storedClips[0];
      if (!clipData) {
        throw new Error("No clips provided for export");
      }

      const categories = getCategories(clipData.project_id);

      // Group clips by their categories
      const clipsByCategory = new Map<number, typeof storedClips>();
      storedClips.forEach(clip => {
        try {
          const clipCategories: number[] = JSON.parse(clip.categories);
          // exportFoldersFor decides which selected folders a clip goes in.
          exportFoldersFor(clipCategories, categoryIds, categories).forEach(catId => {
            const existing = clipsByCategory.get(catId) || [];
            clipsByCategory.set(catId, [...existing, clip]);
          });
        } catch (error) {
          console.warn(`Failed to parse categories for clip ${clip.id}`);
        }
      });

      // Export clips by category
      for (const categoryId of categoryIds) {
        const clips = clipsByCategory.get(categoryId) || [];
        const category = categories.find(c => c.id === categoryId);

        if (!category || clips.length === 0) continue;

        // Create category folder
        const categoryDir = path.join(exportDir, safeFolderName(category.name));
        if (!fs.existsSync(categoryDir)) {
          fs.mkdirSync(categoryDir, { recursive: true });
        }

        // Copy clips to category folder
        for (const clip of clips) {
          if (fs.existsSync(clip.output_path)) {
            // Use clip title for filename, sanitize it (allow spaces, parens, hyphens)
            const safeTitle = clip.title.replace(/[^a-zA-Z0-9 \-\(\)]/g, "_").trim();
            const ext = path.extname(clip.output_path);
            let fileName = `${safeTitle}${ext}`;
            
            let destPath = path.join(categoryDir, fileName);
            
            // Handle duplicates
            let counter = 1;
            while (fs.existsSync(destPath)) {
               fileName = `${safeTitle} (${counter})${ext}`;
               destPath = path.join(categoryDir, fileName);
               counter++;
            }

            fs.copyFileSync(clip.output_path, destPath);
            exportedFiles.push(destPath);
          }
        }
      }

      return {
        exportDir,
        exportedFiles,
        count: exportedFiles.length,
      };
    } catch (error) {
      console.error("Error exporting clips:", error);
      throw error;
    }
  }
);

// Category operations
ipcMain.handle("get-categories", async (_event, projectId: number) => {
  try {
    return getCategories(projectId);
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
});

ipcMain.handle(
  "get-categories-hierarchical",
  async (_event, projectId: number) => {
    try {
      return getCategoriesHierarchical(projectId);
    } catch (error) {
      console.error("Error getting hierarchical categories:", error);
      return [];
    }
  }
);

ipcMain.handle(
  "create-category",
  async (_event, category: Omit<Category, "id" | "created_at">) => {
    try {
      return createCategory(category);
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "clear-project-categories",
  async (_event, projectId: number) => {
    try {
      clearProjectCategories(projectId);
      return true;
    } catch (error) {
      console.error("Error clearing project categories:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "update-category",
  async (_event, id: number, updates: Partial<Category>) => {
    try {
      updateCategory(id, updates);
      return true;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  }
);

ipcMain.handle("delete-category", async (_event, id: number) => {
  try {
    deleteCategory(id);
    return true;
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
});

// Player operations
ipcMain.handle("get-players", async (_event, projectId: number) => {
  try {
    return getPlayers(projectId);
  } catch (error) {
    console.error("Error getting players:", error);
    return [];
  }
});

ipcMain.handle(
  "create-player",
  async (_event, player: Omit<Player, "id" | "created_at">) => {
    try {
      return createPlayer(player);
    } catch (error) {
      console.error("Error creating player:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "update-player",
  async (_event, id: number, updates: Partial<Player>) => {
    try {
      updatePlayer(id, updates);
      return true;
    } catch (error) {
      console.error("Error updating player:", error);
      throw error;
    }
  }
);

ipcMain.handle("delete-player", async (_event, id: number) => {
  try {
    deletePlayer(id);
    return true;
  } catch (error) {
    console.error("Error deleting player:", error);
    throw error;
  }
});

// Annotation operations (saved telestration drawings)
ipcMain.handle(
  "get-annotations",
  async (_event, projectId: number, videoPath: string) => {
    try {
      return getAnnotations(projectId, videoPath);
    } catch (error) {
      console.error("Error getting annotations:", error);
      return [];
    }
  }
);

ipcMain.handle(
  "create-annotation",
  async (_event, annotation: Omit<Annotation, "id" | "created_at">) => {
    try {
      // Only persist annotations against media the app is allowed to read,
      // mirroring the validation on the media-serving paths.
      let resolved = path.resolve(annotation.video_path);
      try {
        resolved = fs.realpathSync(resolved);
      } catch {
        // Non-existent path falls through to the allowlist check below.
      }
      if (!isAllowedMediaPath(resolved)) {
        throw new Error("ERROR_FILE_NOT_FOUND");
      }
      return createAnnotation(annotation);
    } catch (error) {
      console.error("Error creating annotation:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "update-annotation-timing",
  async (_event, id: number, updates: AnnotationTiming) => {
    try {
      updateAnnotationTiming(id, updates);
      return true;
    } catch (error) {
      console.error("Error updating annotation:", error);
      throw error;
    }
  }
);

ipcMain.handle("delete-annotation", async (_event, id: number) => {
  try {
    deleteAnnotation(id);
    return true;
  } catch (error) {
    console.error("Error deleting annotation:", error);
    throw error;
  }
});

// Project operations
ipcMain.handle(
  "create-project",
  async (
    _event,
    projectData: Omit<Project, "id" | "created_at" | "last_opened">
  ) => {
    try {
      if (!isVideoFile(projectData?.video_path)) {
        throw new Error("ERROR_FILE_NOT_FOUND");
      }
      return createProject(projectData);
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-projects-by-video-path", async (_event, videoPath: string) => {
  return getProjectsByVideoPath(videoPath);
});

ipcMain.handle("get-projects", async () => {
  try {
    return getProjects();
  } catch (error) {
    console.error("Error getting projects:", error);
    return [];
  }
});

// Lets the renderer distinguish a real "no projects yet" state from a fatal
// database failure, so a broken DB shows an error instead of a blank window.
ipcMain.handle("get-db-status", async () => getDbStatus());

ipcMain.handle("rename-project", (_event, id: number, name: string) => {
  if (!Number.isSafeInteger(id) || id < 1 || typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 200 && renameProject(id, trimmed);
});

ipcMain.handle(
  "update-project-last-opened",
  async (_event, projectId: number) => {
    try {
      updateProjectLastOpened(projectId);
      return true;
    } catch (error) {
      console.error("Error updating project last opened:", error);
      return false;
    }
  }
);

ipcMain.handle(
  "relink-video-path",
  async (
    _event,
    oldVideoPath: string,
    newVideoPath: string,
    newVideoName: string
  ) => {
    try {
      // The renderer is not trusted with the path, and relinking clears a received record.
      if (!pickedVideos.consume(newVideoPath) || !isVideoFile(newVideoPath)) return "failed";
      const relinked = relinkVideoPath(oldVideoPath, newVideoPath, newVideoName) > 0;
      // The old path is no longer a project video, so it must stop being served.
      if (relinked) allowedMediaPaths.clear();
      return relinked ? "ok" : "failed";
    } catch (error) {
      console.error("Error updating project video path:", error);
      return error instanceof Error && error.message === RECORDING_ALREADY_IN_PROJECT
        ? "duplicate"
        : "failed";
    }
  }
);

ipcMain.handle("delete-project", async (_event, id: number) => {
  if (!validProjectId(id)) throw new Error(INVALID_INPUT);
  try {
    const uid = getProjectById(id)?.uid;
    // Get all clips for this project before deleting
    const clips = getClips(id);

    // Delete clip files from disk
    for (const clip of clips) {
      try {
        // Delete video file
        if (clip.output_path && fs.existsSync(clip.output_path)) {
          fs.unlinkSync(clip.output_path);
        }
        // Delete thumbnail file
        if (clip.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
          fs.unlinkSync(clip.thumbnail_path);
        }
        if (clip.overlay_path && fs.existsSync(clip.overlay_path)) {
          fs.unlinkSync(clip.overlay_path);
        }
      } catch (fileError) {
        console.warn(`Failed to delete files for clip ${clip.id}:`, fileError);
        // Continue deleting other clips even if one fails
      }
    }

    // Delete project from database (CASCADE will delete clips and categories)
    deleteProject(id);
    allowedMediaPaths.clear();
    // The recordings a shared project brought in were copied to videos/<uid>/.
    if (uid) {
      const videosRoot = path.join(app.getPath("userData"), "videos");
      await removeProjectVideosDir(videosRoot, uid, getProjectVideoPaths())
        .then(result => console.log(`Videos folder of deleted project ${uid}: ${result}`))
        .catch(error => console.error("Error removing a deleted project's videos folder:", error));
    }
    return true;
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
});

// Clip operations
ipcMain.handle("get-clips", async (_event, projectId?: number) => {
  try {
    return getClips(projectId);
  } catch (error) {
    console.error("Error getting clips:", error);
    return [];
  }
});

ipcMain.handle(
  "update-clip",
  async (_event, id: number, updates: Partial<Clip>) => {
    try {
      updateClip(id, updates);
      return true;
    } catch (error) {
      console.error("Error updating clip:", error);
      throw error;
    }
  }
);

// Re-cut a clip from its source video with the current saved drawings. The
// new file replaces the old one only once it is complete, so a missing source
// or an ffmpeg failure leaves the clip as it was.
ipcMain.handle(
  "rerender-clip-drawings",
  async (
    _event,
    params: {
      clipId: number;
      drawings: EncodeClipOptions["drawings"];
      drawingsKey: string;
    }
  ) => {
    if (
      !Array.isArray(params.drawings) ||
      params.drawings.length > MAX_CLIP_DRAWINGS ||
      typeof params.drawingsKey !== "string" ||
      params.drawingsKey.length > 4096
    ) {
      throw new Error("ERROR_INVALID_DRAWINGS");
    }
    const clip = getClipById(params.clipId);
    if (!clip) throw new Error("ERROR_CLIP_NOT_FOUND");
    if (!fs.existsSync(clip.video_path)) throw new Error("ERROR_FILE_NOT_FOUND");

    const tempPath = path.join(
      path.dirname(clip.output_path),
      `.rerender-${randomUUID().slice(0, 8)}.mp4`
    );
    try {
      await encodeClip({
        inputPath: clip.video_path.replace(/\\/g, "/"),
        outputPath: tempPath.replace(/\\/g, "/"),
        startTime: clip.start_time,
        duration: clip.duration,
        drawings: params.drawings,
        overlayPath:
          clip.overlay_path && fs.existsSync(clip.overlay_path) ? clip.overlay_path : null,
      });
      // The clip may have been deleted while ffmpeg ran.
      if (!getClipById(params.clipId)) throw new Error("ERROR_CLIP_NOT_FOUND");
      fs.renameSync(tempPath, clip.output_path);
    } catch (error) {
      deleteTempFile(tempPath);
      throw error;
    }
    setClipDrawingsKey(params.clipId, params.drawingsKey);
    return { ...clip, drawings_key: params.drawingsKey };
  }
);

ipcMain.handle("delete-clip", async (_event, id: number) => {
  try {
    // Get clip info to delete file
    const clip = getClipById(id);

    if (clip) {
      // Delete video file
      if (fs.existsSync(clip.output_path)) {
        fs.unlinkSync(clip.output_path);
      }
      // Delete thumbnail if it exists
      if (clip.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
        fs.unlinkSync(clip.thumbnail_path);
      }
      if (clip.overlay_path && fs.existsSync(clip.overlay_path)) {
        fs.unlinkSync(clip.overlay_path);
      }
    }

    deleteClip(id);
    return true;
  } catch (error) {
    console.error("Error deleting clip:", error);
    throw error;
  }
});

ipcMain.handle("play-clip", async (_event, clipPath: string) => {
  try {
    if (typeof clipPath !== "string" || !fs.existsSync(clipPath)) return;
    // openPath launches whatever it is given, so only clip files go through.
    const resolved = fs.realpathSync(clipPath);
    const known =
      isInsideDir(resolved, fs.realpathSync(getClipsDirectory())) ||
      getClips(undefined).some(
        clip => !!clip.output_path && path.resolve(clip.output_path) === path.resolve(clipPath)
      );
    if (known) {
      shell.openPath(clipPath);
    }
  } catch (error) {
    console.error("Error playing clip:", error);
  }
});


ipcMain.handle("reset-database", async () => {
  try {
    // Delete all clip files using the centralized function
    const clipsDir = getClipsDirectory();
    if (fs.existsSync(clipsDir)) {
      fs.rmSync(clipsDir, { recursive: true, force: true });
    }

    // Reset database
    resetDatabase();
    return true;
  } catch (error) {
    console.error("Error resetting application:", error);
    return false;
  }
});

// Set up IPC handlers for key bindings
ipcMain.handle("getKeyBindings", async () => {
  return getKeyBindings();
});

const ALLOWED_EXTERNAL_URLS = [
  "https://github.com/kauredo/basketball-video-analyzer",
  "https://basketballvideoanalyzer.com",
  "https://ko-fi.com/kauredo",
];

ipcMain.handle("open-external", async (_event, url: string) => {
  const ok = ALLOWED_EXTERNAL_URLS.some(
    allowed => url === allowed || url.startsWith(allowed + "/")
  );
  if (!ok) throw new Error("URL not allowed");
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("get-app-version", () => app.getVersion());

// The renderer reports its language so menus and update dialogs match it.
ipcMain.handle("set-app-language", (_event, code: unknown) => {
  if (!setNativeLanguage(code)) return false;
  if (mainWindow) createMenu(mainWindow);
  return true;
});

ipcMain.handle(
  "setKeyBinding",
  async (_, { key, value }: { key: keyof KeyBindings; value: string }) => {
    await setKeyBinding(key, value);
    const newBindings = await getKeyBindings();
    mainWindow.webContents.send("keyBindingsChanged", newBindings);
    return newBindings;
  }
);

// Preset operations
ipcMain.handle(
  "save-preset",
  (_event, presetName: string, categories: Category[]) => {
    return savePreset(presetName, categories);
  }
);

ipcMain.handle("load-preset", (_event, presetName: string) => {
  return loadPreset(presetName);
});

ipcMain.handle("get-presets", () => {
  return getPresets();
});

ipcMain.handle("delete-preset", (_event, presetName: string) => {
  return deletePreset(presetName);
});

const projectClipRows = (projectId: number, clips: Clip[]) => {
  const categoryNames = new Map<number, string>();
  getCategories(projectId).forEach(cat => categoryNames.set(cat.id!, cat.name));
  const playerNames = new Map<number, string>();
  getPlayers(projectId).forEach(p => playerNames.set(p.id!, p.name));
  return clipRows(clips, categoryNames, playerNames);
};

// Export clips data as CSV or JSON
ipcMain.handle(
  "export-clips-data",
  async (_event, projectId: number) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Clips Data",
        defaultPath: path.join(app.getPath("documents"), "clips-export"),
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "JSON", extensions: ["json"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      const ext = path.extname(result.filePath).toLowerCase();
      if (ext !== ".csv" && ext !== ".json") {
        return null;
      }

      const clips = getClips(projectId);
      const rows = projectClipRows(projectId, clips);
      fs.writeFileSync(result.filePath, ext === ".csv" ? clipsCsv(rows) : clipsJson(rows), "utf-8");

      return { filePath: result.filePath, count: clips.length };
    } catch (error) {
      console.error("Error exporting clips data:", error);
      throw error;
    }
  }
);

// Export clips plus the clip list as one zip, to send to players or staff.
// Clip ids come from the renderer; paths come from the database.
ipcMain.handle(
  "export-clips-zip",
  async (_event, params: { projectId: number; clipIds: number[]; untagged: string }) => {
    const { projectId, clipIds } = params;
    if (!Number.isInteger(projectId) || !Array.isArray(clipIds)) {
      throw new Error("ERROR_INVALID_INPUT");
    }
    const project = getProjectById(projectId);
    if (!project) throw new Error("ERROR_INVALID_INPUT");
    const untagged =
      typeof params.untagged === "string" && params.untagged.trim()
        ? params.untagged.slice(0, 100)
        : "Untagged";

    const wanted = new Set(clipIds.filter(id => Number.isInteger(id)));
    const clips = getClips(projectId).filter(clip => wanted.has(clip.id!));
    if (clips.length === 0) return null;
    const withFiles = clips.filter(clip => clip.output_path && fs.existsSync(clip.output_path));
    // A zip with only the two list files would report a success with no clips.
    if (withFiles.length === 0) throw new Error("ERROR_EXPORT_FAILED");

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Clips as Zip",
      defaultPath: path.join(
        app.getPath("documents"),
        `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}-clips.zip`
      ),
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const zipPath = result.filePath;

    const categoryNames = new Map<number, string>();
    getCategories(projectId).forEach(cat => categoryNames.set(cat.id!, cat.name));
    const entries = zipEntries(
      withFiles.map(clip => {
        let first: string | undefined;
        try {
          first = categoryNames.get((JSON.parse(clip.categories) as number[])[0]);
        } catch { /* untagged */ }
        return {
          title: clip.title,
          output_path: clip.output_path,
          folder: safeFolderName(first ?? untagged),
        };
      })
    );

    const rows = projectClipRows(projectId, clips);
    const zip = new yazl.ZipFile();
    // Video is already compressed; deflating it again only costs time.
    entries.forEach(entry => zip.addFile(entry.source, entry.name, { compress: false }));
    zip.addBuffer(Buffer.from(clipsCsv(rows), "utf-8"), "clips.csv");
    zip.addBuffer(Buffer.from(clipsJson(rows), "utf-8"), "clips.json");

    // Write next to the target and rename at the end, so a failure never
    // leaves a half-written zip under the name the user picked.
    const partPath = `${zipPath}.part`;
    try {
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(partPath);
        // Reject once the file is closed, so the cleanup below can delete it
        // on Windows too.
        const fail = (error: Error) => {
          out.removeAllListeners("close");
          out.once("close", () => reject(error));
          out.destroy();
        };
        // A clip file that cannot be read is reported on the ZipFile itself.
        zip.on("error", fail);
        zip.outputStream.on("error", fail);
        out.on("error", fail);
        out.on("close", () => resolve());
        zip.outputStream.pipe(out);
        zip.end();
      });
      fs.renameSync(partPath, zipPath);
    } catch (error) {
      deleteTempFile(partPath);
      console.error("Error exporting clips zip:", error);
      throw new Error("ERROR_EXPORT_FAILED");
    }

    shell.showItemInFolder(zipPath);
    return { filePath: zipPath, count: entries.length, skipped: clips.length - entries.length };
  }
);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Save the court map the renderer drew to a canvas. Only PNG bytes are
// accepted; the path comes from the save dialog here, never from the renderer.
ipcMain.handle(
  "save-shot-chart",
  async (_event, params: { projectId: number; png: Uint8Array }) => {
    const png = params?.png instanceof Uint8Array ? Buffer.from(params.png) : null;
    if (
      !png ||
      png.length > MAX_IMAGE_BYTES ||
      !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    ) {
      throw new Error("ERROR_INVALID_INPUT");
    }
    const project = getProjectById(params.projectId);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Court Map",
      defaultPath: path.join(
        app.getPath("documents"),
        `${(project?.name || "court").replace(/[^a-zA-Z0-9]/g, "_")}-court-map.png`
      ),
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, png);
    return { filePath: result.filePath };
  }
);

// Print the scouting report to PDF. The renderer sends the numbers it already
// shows on the stats tab; the page is built here, escaped, and loaded in a
// hidden window with JavaScript off, from a temp file, with no network use.
ipcMain.handle(
  "export-scouting-report",
  async (
    _event,
    params: { projectId: number; recordingId?: number; report: unknown; dots: CourtDot[]; legend: CourtLegendItem[] }
  ) => {
    const project = getProjectById(params?.projectId);
    if (!project) throw new Error("ERROR_INVALID_INPUT");
    const { data, labels } = normalizeReport(params.report);
    data.projectName = project.name;
    const recordings = getProjectVideos(params.projectId);
    if (params.recordingId !== undefined) {
      const recording = recordings.find(video => video.id === params.recordingId);
      if (!recording) throw new Error("ERROR_INVALID_INPUT");
      data.videoName = recording.video_name;
    } else if (recordings.length <= 1) {
      data.videoName = project.video_name;
    }
    const dots = (Array.isArray(params.dots) ? params.dots : []).slice(0, 5000).map(d => ({
      x: Number(d?.x),
      y: Number(d?.y),
      color: String(d?.color ?? ""),
      label: String(d?.label ?? "").slice(0, 300),
    }));
    const legend = (Array.isArray(params.legend) ? params.legend : []).slice(0, 100).map(item => ({
      color: String(item?.color ?? ""),
      label: String(item?.label ?? "").slice(0, 200),
    }));
    const chart = dots.length
      ? courtSvg(dots, { background: "#ffffff", lines: "#4a4a4a", text: "#1f1f1f", legend })
      : null;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Scouting Report",
      defaultPath: path.join(
        app.getPath("documents"),
        `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}-scouting-report.pdf`
      ),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;

    const htmlPath = path.join(app.getPath("temp"), `bva-report-${randomUUID()}.html`);
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        javascript: false,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Its own in-memory session, so the request block below never
        // touches the main window.
        partition: "report-print",
      },
    });
    // Nothing on the page links anywhere; refuse any web request it makes.
    win.webContents.session.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (_details, callback) =>
      callback({ cancel: true })
    );
    win.webContents.on("will-navigate", e => e.preventDefault());
    try {
      // Readable by this user only: Linux shares /tmp between users.
      fs.writeFileSync(htmlPath, scoutingReportHtml(data, labels, chart), { encoding: "utf-8", mode: 0o600 });
      await win.loadFile(htmlPath);
      const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
      fs.writeFileSync(result.filePath, pdf);
      return { filePath: result.filePath };
    } catch (error) {
      console.error("Error exporting scouting report:", error);
      throw new Error("ERROR_EXPORT_FAILED");
    } finally {
      win.destroy();
      deleteTempFile(htmlPath);
    }
  }
);

// Export clips as a Sportscode-compatible timeline XML
ipcMain.handle("export-clips-xml", async (_event, projectId: number) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Sportscode XML",
      defaultPath: path.join(
        app.getPath("documents"),
        `${(getProjectById(projectId)?.name || "clips").replace(/[^a-zA-Z0-9]/g, "_")}-sportscode.xml`
      ),
      filters: [{ name: "XML", extensions: ["xml"] }],
    });

    if (result.canceled || !result.filePath) return null;

    const clips = getClips(projectId);
    const categories = getCategories(projectId);
    const categoryName = new Map<number, string>();
    const categoryColor = new Map<number, string>();
    categories.forEach(cat => {
      if (cat.id) {
        categoryName.set(cat.id, cat.name);
        categoryColor.set(cat.id, cat.color);
      }
    });
    const players = getPlayers(projectId);
    const playerLabel = new Map<number, string>();
    players.forEach(p => {
      if (p.id) playerLabel.set(p.id, p.number ? `${p.number} ${p.name}` : p.name);
    });

    const escapeXml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    // Sportscode uses 16-bit colour channels (0-65535).
    const hexTo16 = (hex: string) => {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
      if (!m) return { r: 32896, g: 32896, b: 32896 };
      const ch = (i: number) => Math.round(parseInt(m[1].slice(i, i + 2), 16) * 257);
      return { r: ch(0), g: ch(2), b: ch(4) };
    };

    const parseIds = (json: string): number[] => {
      try {
        const ids = JSON.parse(json);
        return Array.isArray(ids) ? ids : [];
      } catch {
        return [];
      }
    };

    const label = (group: string, text: string) =>
      `      <label>\n        <group>${escapeXml(group)}</group>\n        <text>${escapeXml(text)}</text>\n      </label>`;

    // one <row> per distinct code, in first-appearance order
    const rowColors = new Map<string, { r: number; g: number; b: number }>();
    const instances: string[] = [];
    let id = 1;

    for (const clip of clips) {
      const catIds = parseIds(clip.categories);
      const code = catIds.length ? categoryName.get(catIds[0]) || "Untagged" : "Untagged";
      if (!rowColors.has(code)) {
        const hex = catIds.length ? categoryColor.get(catIds[0]) || "" : "";
        rowColors.set(code, hexTo16(hex));
      }

      const labels: string[] = [];
      catIds.slice(1).forEach(cid => {
        const n = categoryName.get(cid);
        if (n) labels.push(label("Category", n));
      });
      parseIds(clip.players || "[]").forEach(pid => {
        const p = playerLabel.get(pid);
        if (p) labels.push(label("Player", p));
      });
      if (clip.quarter) labels.push(label("Quarter", clip.quarter));
      if (clip.notes && clip.notes.trim()) labels.push(label("Note", clip.notes.trim()));
      if (clip.status) labels.push(label("Status", clip.status));

      instances.push(
        `    <instance>\n      <ID>${id}</ID>\n      <start>${clip.start_time.toFixed(2)}</start>\n      <end>${clip.end_time.toFixed(2)}</end>\n      <code>${escapeXml(code)}</code>${labels.length ? "\n" + labels.join("\n") : ""}\n    </instance>`
      );
      id++;
    }

    const rows = [...rowColors.entries()]
      .map(
        ([code, c]) =>
          `    <row>\n      <code>${escapeXml(code)}</code>\n      <R>${c.r}</R>\n      <G>${c.g}</G>\n      <B>${c.b}</B>\n    </row>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<file>\n  <ALL_INSTANCES>\n${instances.join("\n")}\n  </ALL_INSTANCES>\n  <ROWS>\n${rows}\n  </ROWS>\n</file>\n`;

    fs.writeFileSync(result.filePath, xml, "utf-8");
    return { filePath: result.filePath, count: clips.length };
  } catch (error) {
    console.error("Error exporting Sportscode XML:", error);
    throw error;
  }
});

// The same reader the review builds the local side with, so a sent snapshot and the project compare alike.
const projectSession = (projectId: number, project: Project) => {
  const source = getSessionSource(projectId);
  if (!source) throw new Error(INVALID_INPUT);
  return buildSession({ ...source, project }, isSamePath);
};

// Save analysis session as JSON
ipcMain.handle("save-session", async (_event, projectId: number) => {
  try {
    const project = getProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const sessionData = projectSession(projectId, project);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Analysis Session",
      defaultPath: path.join(app.getPath("documents"), `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}-session.json`),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePath) return null;

    fs.writeFileSync(result.filePath, JSON.stringify(sessionData, null, 2), "utf-8");
    return { filePath: result.filePath, success: true };
  } catch (error) {
    console.error("Error saving session:", error);
    throw error;
  }
});

// Asks for one recording of a loaded session. Null when the coach cancels.
const pickSessionRecording = async (
  name: string, index: number, count: number, taken: string[],
): Promise<string | null> => {
  const videoResult = await dialog.showOpenDialog(mainWindow, {
    title: count > 1
      ? `${index + 1}/${count} · ${name}`
      : name || "Select Video File for This Session",
    properties: ["openFile"],
    filters: [{ name: "Videos", extensions: PICKER_EXTENSIONS }],
  });
  const picked = videoResult.filePaths[0];
  if (videoResult.canceled || !picked) return null;
  // Checked before converting too, so a refused pick doesn't cost a full copy first.
  // `taken` holds the copies, so a source already copied for this session counts as taken too.
  if (taken.some(existing => isSamePath(existing, picked) || isSamePath(copiedFrom.get(existing) ?? "", picked))) {
    throw new Error("INVALID_SESSION_FILE");
  }
  const file = await ensurePlayable(picked);
  if (!file) return null;
  if (!isVideoFile(file) || taken.some(existing => isSamePath(existing, file))) {
    throw new Error("INVALID_SESSION_FILE");
  }
  return file;
};

const validProjectId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;

// The one share or import running now, so the renderer can cancel it, the
// shared project waiting for the coach's choice, and the .bvap the last share
// wrote, for "Show in folder". The renderer never sends a path.
const shareOperations = new ShareOperations<PendingShare>();
let lastSharedFile: string | null = null;

// A closed window can't see progress or press Cancel, so its operation stops.
const whileSenderLives = <T>(sender: Electron.WebContents, work: () => Promise<T>): Promise<T> => {
  const stop = () => shareOperations.cancel();
  sender.once("destroyed", stop);
  return work().finally(() => sender.removeListener("destroyed", stop));
};

// Closing the window quits the app. A share or import still running is
// cancelled first, and the quit waits until it has removed what it copied.
app.on("before-quit", event => {
  // A conversion stopped by the quit would leave its .part file behind.
  if (conversion) {
    event.preventDefault();
    const { process: child } = conversion;
    child.once("close", () => setImmediate(() => app.quit()));
    cancelConversion();
    return;
  }
  if (!shareOperations.running) return;
  event.preventDefault();
  shareOperations.cancel();
  shareOperations.idle().then(() => app.quit());
});

const sendProgress = (sender: Electron.WebContents, channel: string, progress: unknown) => {
  if (!sender.isDestroyed()) sender.send(channel, progress);
};

// The sizes behind "Include game videos (X GB)" and the total a share copies,
// counted as share-project's plan counts them so the progress total matches.
ipcMain.handle("get-share-size", async (_event, projectId: number) => {
  if (!validProjectId(projectId) || !getProjectById(projectId)) throw new Error("ERROR_INVALID_INPUT");
  const recordings = getProjectVideos(projectId);
  const videos = await Promise.all(recordings.map(video => statSource(video.video_path, VIDEO_SOURCE)));
  // The checkbox still shows the videos' size when the plan cannot be made (a recording without a uid).
  const clipBytes = await planShareCopies({ recordings, clips: getClips(projectId), includeVideos: false })
    .then(plan => plan.totalBytes)
    .catch(error => {
      console.error("Error sizing a share's clips:", error);
      return 0;
    });
  return { videoBytes: videos.reduce((total, video) => total + (video?.size ?? 0), 0), clipBytes };
});

// Write the project, its cut clips and (optionally) its videos into a new
// folder the coach can send any way they like. Main picks the folder; the
// work itself is in shareBundle.ts.
ipcMain.handle("share-project", async (event, params: { projectId: number; includeVideos: boolean }) => {
  const projectId = params?.projectId;
  const includeVideos = params?.includeVideos;
  if (!validProjectId(projectId) || typeof includeVideos !== "boolean") throw new Error("ERROR_INVALID_INPUT");
  const project = getProjectById(projectId);
  if (!project) throw new Error("ERROR_INVALID_INPUT");
  const sender = event.sender;
  try {
    return await whileSenderLives(sender, () => shareOperations.run(signal => shareProject(sender, signal, {
      projectId, project, includeVideos,
    })));
  } catch (error) {
    throw appError(error, SHARE_FAILED);
  }
});

const shareProject = async (
  sender: Electron.WebContents, signal: AbortSignal,
  { projectId, project, includeVideos }: { projectId: number; project: Project; includeVideos: boolean },
) => {
  const recordings = getProjectVideos(projectId);
  // Sharing reads each recording, through any link, for its fingerprint and the copy.
  const checkReceived = () => recordings.forEach(recording => assertReceived(recording.video_path));
  checkReceived();
  const plan = await planShareCopies({ recordings, clips: getClips(projectId), includeVideos });

  const picked = await dialog.showOpenDialog(mainWindow, {
    title: nt("shareDialogTitle"),
    properties: ["openDirectory", "createDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  if (signal.aborted) throw new Error(SHARE_CANCELLED);
  const parent = await fs.promises.realpath(picked.filePaths[0]);
  if (!hasFreeSpace(() => fs.statfsSync(parent), plan.totalBytes)) throw new Error(INSUFFICIENT_SPACE);
  checkReceived();

  const fingerprints = await Promise.all(plan.recordings.map(recording =>
    recording.path === null ? null : fingerprintFile(recording.path).catch(error => {
      console.error("Error fingerprinting a recording:", error);
      const code = mapShareError((error as NodeJS.ErrnoException).code);
      throw new Error(code === SHARE_FILE_MISSING ? `${code} ${path.basename(recording.path!)}` : code);
    })));
  if (signal.aborted) throw new Error(SHARE_CANCELLED);

  const bundle = buildManifest({
    recordings: plan.recordings.map((recording, index) => ({
      uid: recording.uid, videoFile: recording.videoFile, fingerprint: fingerprints[index],
    })),
    clips: plan.clipFiles,
  });
  const shareBlock = { id: randomUUID(), basedOn: latestReceivedShareId(projectId) };
  // One stringify: the snapshot stores it as is, the .bvap appends its two blocks.
  const sessionJson = JSON.stringify(projectSession(projectId, project));
  const bvap = `${sessionJson.slice(0, -1)},"share":${JSON.stringify(shareBlock)},"bundle":${JSON.stringify(bundle)}}`;

  const folderName = uniqueName(safeName(project.name, "Project"), name => fs.existsSync(path.join(parent, name)));
  const bvapName = `${folderName}.bvap`;
  const folder = await runShare({
    parent,
    folderName,
    copies: plan.copies,
    signal,
    onProgress: progress => sendProgress(sender, "share-progress", progress),
    writeBvap: dir => fs.promises.writeFile(path.join(dir, bvapName), bvap, { encoding: "utf-8", flag: "wx" }),
    onComplete: () => saveShareSnapshot({ id: shareBlock.id, projectId, direction: "sent", data: sessionJson }),
  });

  lastSharedFile = path.join(folder, bvapName);
  return {
    folderName,
    clips: plan.clipFiles.length,
    videos: plan.recordings.filter(recording => recording.videoFile !== null).length,
  };
};

ipcMain.handle("cancel-share", () => shareOperations.cancel());

ipcMain.handle("show-shared-project", () => {
  if (lastSharedFile) shell.showItemInFolder(lastSharedFile);
});

// Copies a checked shared project's files and writes its rows and its
// 'received' snapshot in one transaction; shareImport.ts does the work.
const importSharedProject = async (
  pending: NewShare, copyVideos: boolean, signal: AbortSignal, sender: Electron.WebContents,
) => {
  const userData = app.getPath("userData");
  const plan = planImportCopies({
    recordings: pending.recordings,
    clips: pending.clips,
    copyVideos,
    videosDir: path.join(userData, "videos", pending.session.project.uid as string),
    clipsDir: getClipsDirectory(),
    exists: fs.existsSync,
    newName: randomUUID,
  });
  if (!hasFreeSpace(() => fs.statfsSync(userData), plan.totalBytes)) throw new Error(INSUFFICIENT_SPACE);
  const project = await runImport({
    copies: plan.copies,
    signal,
    onProgress: progress => sendProgress(sender, "import-progress", progress),
    write: () => inProjectTransaction(() => {
      const created = writeSession(pending.session, plan.paths, {
        createProject, addProjectVideo, createCategory, createPlayer, createClip, createAnnotation,
      }, plan.clipFiles);
      if (!copyVideos && created.id) {
        pending.recordings.forEach((recording, index) => {
          if (recording.bundle) setReceivedInPlace(created.id!, plan.paths[index], recording.bundle);
        });
      }
      if (pending.snapshot && created.id) {
        insertShareSnapshotInTransaction({ ...pending.snapshot, projectId: created.id, direction: "received" });
      }
      return created;
    }),
  });
  return { status: "imported" as const, project };
};

const contentLookups: ContentLookups = {
  // A changed received recording is not read for a fingerprint.
  localPaths: () => getProjectVideoPaths().filter(local => {
    try {
      assertReceived(local);
      return true;
    } catch {
      return false;
    }
  }),
  sizeOf: async local => (await statSource(local, VIDEO_SOURCE))?.size ?? null,
  fingerprintOf: fingerprintFile,
  pick: pickSessionRecording,
  isSamePath,
};

const localSession = (projectId: number) => {
  const source = getSessionSource(projectId);
  if (!source) throw new Error(INVALID_INPUT);
  return sessionFromLocal(source, isSamePath);
};

// A project that comes back: compare it with what was sent and hold the
// differences for the review screen. Only what a merge can use is resolved:
// the recordings this project lacks, and the cut files of new or moved clips.
const openReview = async (shared: SharedFile, projectId: number, signal: AbortSignal) => {
  const project = getProjectById(projectId);
  if (!project) throw new Error(INVALID_INPUT);
  const standing = classifyShare(shared, projectId, getShareSnapshotById);
  if (standing.kind === "applied") return { status: "applied" as const, name: project.name };
  const mine = localSession(projectId);
  const theirs = shared.parsed;
  const diff = diffSessions(standing.base ? parseSession(standing.base.data) : null, mine, theirs);

  const needs = mergeNeeds(diff, mine, theirs);
  const recordings = theirs.recordings.filter(video => needs.recordings.includes(video.uid as string));
  const clips = theirs.clips.filter(clip => needs.clips.includes(clip.uid as string));
  const contents = await resolveBundleContents(
    { ...shared, parsed: { ...theirs, recordings, clips } }, { ...contentLookups, preferLocal: true });
  if (!contents) return null;
  if (signal.aborted) throw new Error(SHARE_CANCELLED);

  const clipFiles = new Map(clips.flatMap((clip, index) => {
    const bundled = contents.clips[index];
    return bundled ? [[clip.uid as string, bundled] as const] : [];
  }));
  shareOperations.hold({
    kind: "merge",
    projectId,
    session: theirs,
    mine,
    diff,
    recordings: new Map(recordings.map((video, index) => [video.uid as string, contents.recordings[index]])),
    clips: clipFiles,
    snapshot: standing.snapshot,
  });
  return {
    status: "review" as const,
    name: project.name,
    review: reviewSummary(diff, mine, theirs, new Set(clipFiles.keys())),
  };
};

// The review compared the project as it was when it opened; an edit since then refuses the apply.
const assertFresh = (pending: MergeShare) => {
  if (!sessionsMatch(localSession(pending.projectId), pending.mine)) throw new Error(REVIEW_STALE);
};

// Copies what the ticked rows need, then applies them and saves the
// 'received' snapshot in one transaction. The files of deleted or re-timed
// clips are removed only once that has committed.
const mergeSharedProject = async (
  pending: MergeShare, plan: MergePlan, copyVideos: boolean, signal: AbortSignal, sender: Electron.WebContents,
) => {
  const project = getProjectById(pending.projectId);
  if (!project) throw new Error(INVALID_INPUT);
  const userData = app.getPath("userData");
  const planned = planMergeCopies(plan, pending, {
    copyVideos,
    videosDir: path.join(userData, "videos", project.uid as string),
    clipsDir: getClipsDirectory(),
    exists: fs.existsSync,
    newName: randomUUID,
  });
  if (!hasFreeSpace(() => fs.statfsSync(userData), planned.totalBytes)) throw new Error(INSUFFICIENT_SPACE);
  const { removedFiles } = await runImport({
    copies: planned.copies,
    signal,
    onProgress: progress => sendProgress(sender, "import-progress", progress),
    write: () => applyShareMerge(pending.projectId, plan, planned.files, pending.snapshot, () => assertFresh(pending), () => {
      if (copyVideos) return;
      for (const uid of plan.newRecordings) {
        const bundle = pending.recordings.get(uid)?.bundle;
        const videoPath = planned.files.recordingPaths.get(uid);
        if (bundle && videoPath) setReceivedInPlace(pending.projectId, videoPath, bundle);
      }
    }),
  });
  await removeMergedFiles(removedFiles, getClipsDirectory());
  return {
    status: "merged" as const,
    project: getProjectById(pending.projectId),
    kept: plan.kept.length,
    heldBack: plan.heldBack,
  };
};

// Open a .bvap folder another coach shared, or an old .json session: a
// project already here goes to the review, anything else imports as new.
// Every file in the folder goes through resolveBundleFile.
const openSharedProject = async (sender: Electron.WebContents, signal: AbortSignal) => {
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: nt("openSharedDialogTitle"),
    properties: ["openFile"],
    filters: [{ name: nt("sharedProjectFiles"), extensions: ["bvap", "json"] }],
  });
  const file = picked.filePaths[0];
  if (picked.canceled || !file) return null;

  const shared = await readSharedFile(file);
  const { parsed } = shared;
  const existing = alreadyHave({ bvap: shared.bvap, version: parsed.version, projectUid: parsed.project.uid }, getProjectIdByUid);
  if (existing !== null) return openReview(shared, existing, signal);

  const contents = await resolveBundleContents(shared, contentLookups);
  if (!contents) return null;
  if (signal.aborted) throw new Error(SHARE_CANCELLED);

  const names = new Set(getProjects().map(project => project.name));
  const pending = prepareNewImport(shared, contents, {
    uidExists: anyUidExists,
    nameTaken: name => names.has(name),
    suffix: nt("sharedProjectSuffix"),
    newUid: randomUUID,
  });
  if (!pending.recordings.some(recording => recording.bundle)) {
    return importSharedProject(pending, false, signal, sender);
  }

  shareOperations.hold(pending);
  const videoBytes = pending.recordings.reduce((total, recording) => total + (recording.bundle?.size ?? 0), 0);
  const clipBytes = pending.clips.reduce(
    (total, clip) => total + (clip ? clip.clip.size + (clip.thumbnail?.size ?? 0) : 0), 0);
  return {
    status: "choose" as const,
    videoBytes,
    canCopy: hasFreeSpace(() => fs.statfsSync(app.getPath("userData")), videoBytes + clipBytes),
  };
};

ipcMain.handle("open-shared-project", async event => {
  const sender = event.sender;
  try {
    shareOperations.discard();
    return await whileSenderLives(sender, () => shareOperations.run(signal => openSharedProject(sender, signal)));
  } catch (error) {
    console.error("Error opening shared project:", error);
    throw appError(error, IMPORT_FAILED);
  }
});

ipcMain.handle("finish-shared-project", async (event, copyVideos: unknown) => {
  if (typeof copyVideos !== "boolean") throw new Error(INVALID_INPUT);
  const sender = event.sender;
  try {
    return await whileSenderLives(sender, () => shareOperations.finish((pending, signal) => {
      if (pending.kind !== "new") throw new Error(INVALID_INPUT);
      return importSharedProject(pending, copyVideos, signal, sender);
    }));
  } catch (error) {
    console.error("Error importing shared project:", error);
    throw appError(error, IMPORT_FAILED);
  }
});

// The coach's picks on the review screen. When a ticked new recording comes
// in the bundle and the coach has not said yet, it asks to copy or use in place.
ipcMain.handle("apply-shared-review", async (event, selections: unknown, copyVideos: unknown) => {
  if (copyVideos !== undefined && typeof copyVideos !== "boolean") throw new Error(INVALID_INPUT);
  const pending = shareOperations.waiting;
  if (pending?.kind !== "merge") throw new Error(INVALID_INPUT);
  const plan = planMerge(pending.diff, pending.mine, pending.session, validateSelections(pending.diff, selections));

  const sender = event.sender;
  try {
    assertFresh(pending);
    const choice = copyVideos === undefined ? copyChoice(plan, pending) : null;
    if (choice) {
      return {
        status: "choose" as const,
        videoBytes: choice.videoBytes,
        canCopy: hasFreeSpace(() => fs.statfsSync(app.getPath("userData")), choice.totalBytes),
      };
    }
    return await whileSenderLives(sender, () => shareOperations.finish((held, signal) => {
      if (held !== pending) throw new Error(INVALID_INPUT);
      return mergeSharedProject(pending, plan, copyVideos === true, signal, sender);
    }));
  } catch (error) {
    console.error("Error applying shared project changes:", error);
    throw appError(error, IMPORT_FAILED);
  }
});

ipcMain.handle("discard-shared-project", () => shareOperations.discard());

ipcMain.handle("cancel-shared-import", () => shareOperations.cancel());

// Resolve bundled yt-dlp binary path (handles ASAR unpacking)
const getYtdlpPath = (): string => {
  const { YOUTUBE_DL_PATH } = require("youtube-dl-exec/src/constants");
  return fixAsarPath(YOUTUBE_DL_PATH);
};

// Release builds ship deno next to yt-dlp, which uses it to solve YouTube's
// challenges. Dev installs may not have it.
const getDenoPath = (): string | null => {
  const deno = path.join(
    path.dirname(getYtdlpPath()),
    process.platform === "win32" ? "deno.exe" : "deno"
  );
  return fs.existsSync(deno) ? deno : null;
};

// The import running now, so the renderer can cancel it.
let activeDownload: { process: ChildProcess; cancelled: boolean } | null = null;

const stopDownload = (download: { process: ChildProcess; cancelled: boolean }) => {
  download.cancelled = true;
  const { pid } = download.process;
  // The Windows yt-dlp build runs in a child of the process we started, and
  // Windows does not pass the kill down, so end the whole tree there.
  if (process.platform === "win32" && pid) {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"]).on("error", () => download.process.kill());
  } else {
    download.process.kill();
  }
};

// Download a YouTube or Vimeo video using the bundled yt-dlp
ipcMain.handle("download-youtube-video", async (event, url: string) => {
  const videoUrl = parseVideoLink(url);
  if (!videoUrl) {
    throw new Error("INVALID_YOUTUBE_URL");
  }
  if (activeDownload) {
    throw new Error("DOWNLOAD_BUSY");
  }

  const downloadsDir = path.join(app.getPath("userData"), "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const ytdlpPath = getYtdlpPath();
  const denoPath = getDenoPath();
  const pathFile = path.join(downloadsDir, `.download-${randomUUID()}.txt`);

  return new Promise<{ filePath: string; fileName: string; success: boolean }>((resolve, reject) => {
    const ytdlp = spawn(ytdlpPath, [
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", path.join(downloadsDir, "%(title)s.%(ext)s"),
      "--no-playlist",
      "--newline",
      "--print-to-file", "after_move:filepath", templateLiteral(pathFile),
      // Merging video and audio needs ffmpeg, and most users have none on PATH.
      "--ffmpeg-location", ffmpegPath,
      ...(denoPath ? ["--js-runtimes", `deno:${denoPath}`] : []),
      "--",
      videoUrl,
    ]);
    const download = { process: ytdlp, cancelled: false };
    activeDownload = download;

    // A reload drops the progress bar and its Cancel button, so stop the
    // download with it instead of leaving it running unseen.
    const onNavigate = (_e: unknown, _url: string, isInPlace: boolean, isMainFrame: boolean) => {
      if (isMainFrame && !isInPlace) stopDownload(download);
    };
    event.sender.on("did-start-navigation", onNavigate);

    const lines = new LineBuffer();
    ytdlp.stdout.on("data", (data: Buffer) => {
      for (const line of lines.push(data.toString())) {
        const percent = progressPercent(line);
        if (percent !== null) {
          mainWindow?.webContents.send("youtube-download-progress", {
            percent,
            status: "downloading",
          });
        }
      }
    });

    ytdlp.stderr.on("data", (data: Buffer) => {
      console.error("yt-dlp stderr:", data.toString());
    });

    const finish = (error: Error | null) => {
      if (activeDownload === download) activeDownload = null;
      event.sender.removeListener("did-start-navigation", onNavigate);
      let filePath: string | null = null;
      try {
        filePath = lastPrintedPath(fs.readFileSync(pathFile, "utf8"));
        fs.unlinkSync(pathFile);
      } catch {
        // No path file: yt-dlp failed or was stopped before the move.
      }
      const outcome = downloadOutcome({
        cancelled: download.cancelled,
        failed: error !== null,
        filePath,
        fileExists: !!filePath && fs.existsSync(filePath),
      });
      if (outcome === "cancelled") reject(new Error("DOWNLOAD_CANCELLED"));
      else if (outcome === "failed") reject(new Error("DOWNLOAD_FAILED"));
      else resolve({ filePath: outcome.filePath, fileName: path.basename(outcome.filePath), success: true });
    };

    ytdlp.on("close", code => finish(code === 0 ? null : new Error(`yt-dlp exited ${code}`)));
    ytdlp.on("error", error => finish(error));
  });
});

ipcMain.handle("cancel-youtube-download", () => {
  if (!activeDownload) return false;
  stopDownload(activeDownload);
  return true;
});
