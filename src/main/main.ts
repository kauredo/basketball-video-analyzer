import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { v4 as uuidv4 } from "uuid";
import { setupAutoUpdater, checkForUpdates } from "./autoUpdater";
import {
  setupDatabase,
  getCategories,
  getCategoriesHierarchical,
  createCategory,
  clearProjectCategories,
  updateCategory,
  deleteCategory,
  getClips,
  createClip,
  updateClip,
  deleteClip,
  getClipsByCategory,
  createProject,
  getProject,
  getProjectById,
  getProjects,
  updateProjectLastOpened,
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
} from "./database";

// Helper function to fix ASAR unpacked paths
const fixAsarPath = (binaryPath: string): string => {
  // In production, binaries are in app.asar.unpacked, not app.asar
  // This is critical for Electron packaging to work correctly
  let fixedPath = binaryPath.replace("app.asar", "app.asar.unpacked");

  // Normalize and convert to forward slashes for fluent-ffmpeg
  fixedPath = path.normalize(fixedPath).replace(/\\/g, "/");

  return fixedPath;
};

// Set FFmpeg and FFprobe paths
if (ffmpegStatic) {
  const ffmpegPath = fixAsarPath(ffmpegStatic);
  console.log("FFmpeg path:", ffmpegPath);
  console.log("FFmpeg exists:", fs.existsSync(ffmpegPath));
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.error("FFmpeg static path not found!");
}

if (ffprobeStatic.path) {
  const ffprobePath = fixAsarPath(ffprobeStatic.path);
  console.log("FFprobe path:", ffprobePath);
  console.log("FFprobe exists:", fs.existsSync(ffprobePath));
  ffmpeg.setFfprobePath(ffprobePath);
} else {
  console.error("FFprobe static path not found!");
}

let mainWindow: BrowserWindow;

// Track active clip creation processes
const activeClipProcesses = new Map<string, any>();

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
                label: "Check for Updates...",
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
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    // Edit menu
    {
      label: "Edit",
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
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // Help menu
    {
      label: "Help",
      submenu: [
        ...(!isMac
          ? [
              {
                label: "Check for Updates...",
                click: () => checkForUpdates(mainWindow),
              },
              { type: "separator" },
            ]
          : []),
        {
          label: "Send Feedback...",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("open-feedback");
            }
          },
        },
        { type: "separator" },
        {
          label: "Learn More",
          click: async () => {
            await shell.openExternal(
              "https://github.com/kauredo/basketball-video-analyzer"
            );
          },
        },
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
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

app.whenReady().then(() => {
  setupDatabase();
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

// Get clips directory in app's userData folder
const getClipsDirectory = () => {
  // Use userData folder - always accessible, no permissions needed
  const userDataDir = app.getPath("userData");
  const clipsDir = path.join(userDataDir, "clips");
  return clipsDir;
};

// Pre-flight system checks
ipcMain.handle("system-check", async () => {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    // Check FFmpeg availability
    const ffmpegPath = ffmpegStatic;
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
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
        ffmpegPath: ffmpegPath || "not found",
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
    const process = activeClipProcesses.get(processId);
    if (process) {
      process.kill();
      activeClipProcesses.delete(processId);
      return { success: true };
    }
    return { success: false, reason: "Process not found" };
  } catch (error) {
    console.error("Error cancelling clip creation:", error);
    return { success: false, reason: "Cancel failed" };
  }
});

// Video file operations
ipcMain.handle("select-video-file", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Videos",
          extensions: ["mp4", "mov", "avi", "mkv", "webm", "m4v"],
        },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error("Error selecting video file:", error);
    return null;
  }
});

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
      notes?: string;
      projectId: number;
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
          notes,
          projectId,
        } = params;

        // Use native path separators for file system operations
        const normalizedInputPath = path.normalize(inputPath);
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
        const clipId = uuidv4().slice(0, 8);
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
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

        // Validate input parameters
        if (duration <= 0) {
          console.error("Invalid duration:", duration);
          reject(new Error("ERROR_INVALID_DURATION"));
          return;
        }

        if (startTime < 0 || endTime < 0) {
          console.error(
            "Invalid time values - startTime:",
            startTime,
            "endTime:",
            endTime
          );
          reject(new Error("ERROR_INVALID_TIME"));
          return;
        }

        if (!title || title.trim().length === 0) {
          console.error("Empty or invalid title provided");
          reject(new Error("ERROR_INVALID_TITLE"));
          return;
        }

        if (!categories || categories.length === 0) {
          console.error("No categories provided");
          reject(new Error("ERROR_NO_CATEGORIES"));
          return;
        }

        // Validate that input file exists and is accessible
        if (!fs.existsSync(normalizedInputPath)) {
          console.error("Input file does not exist:", normalizedInputPath);
          reject(new Error("ERROR_FILE_NOT_FOUND"));
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

        console.log("Using globally configured FFmpeg and FFprobe paths");

        // Generate process ID for cancellation support
        const processId = uuidv4().slice(0, 8);
        mainWindow.webContents.send("clip-process-id", { processId });

        // First, generate the thumbnail
        const thumbnailCommand = ffmpeg(ffmpegInputPath);

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
            activeClipProcesses.set(`${processId}-thumb`, thumbnailCommand);
          })
          .on("error", error => {
            console.error("Thumbnail creation error:", error);
            console.error("Thumbnail error message:", error.message);
            console.error("FFmpeg input path:", ffmpegInputPath);
            console.error("FFmpeg thumbnail path:", ffmpegThumbnailPath);
            activeClipProcesses.delete(`${processId}-thumb`);
            reject(new Error("ERROR_THUMBNAIL_FAILED"));
          })
          .on("end", () => {
            activeClipProcesses.delete(`${processId}-thumb`);
            console.log("Thumbnail created successfully");

            // After thumbnail is created, create the clip
            console.log("Starting clip creation...");
            const clipCommand = ffmpeg(ffmpegInputPath);

            clipCommand
              .setStartTime(startTime)
              .setDuration(duration)
              .outputOptions([
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
              ])
              .output(ffmpegOutputPath)
              .on("start", commandLine => {
                console.log("Clip FFmpeg command:", commandLine);
                // Store the clip process for potential cancellation
                activeClipProcesses.set(processId, clipCommand);
              })
              .on("end", () => {
                activeClipProcesses.delete(processId);
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
                    notes: notes,
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
                  reject(new Error("ERROR_DATABASE_FAILED"));
                }
              })
              .on("error", error => {
                activeClipProcesses.delete(processId);
                console.error("FFmpeg clip creation error:", error);
                console.error("Error stack:", error.stack);
                console.error("Input path:", normalizedInputPath);
                console.error("Output path:", outputPath);
                console.error("Start time:", startTime);
                console.error("Duration:", duration);
                reject(new Error("ERROR_FFMPEG_FAILED"));
              })
              .on("progress", progress => {
                mainWindow.webContents.send("clip-progress", {
                  percent: progress.percent || 0,
                  timemark: progress.timemark,
                });
              })
              .run();
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

      // Get project ID from the first clip (all clips should be from same project)
      const firstClip = params.clips[0];
      if (!firstClip) {
        throw new Error("No clips provided for export");
      }

      // Get the project ID from the clip
      const clipData = getClips(undefined).find(c => c.id === firstClip.id);
      if (!clipData) {
        throw new Error("Could not find clip data to determine project");
      }

      const categories = getCategories(clipData.project_id);

      // Group clips by their categories
      const clipsByCategory = new Map<number, typeof params.clips>();
      params.clips.forEach(clip => {
        try {
          const clipCategories = JSON.parse(clip.categories);
          clipCategories.forEach((catId: number) => {
            if (params.categoryIds.includes(catId)) {
              const existing = clipsByCategory.get(catId) || [];
              clipsByCategory.set(catId, [...existing, clip]);
            }
          });
        } catch (error) {
          console.warn(`Failed to parse categories for clip ${clip.id}`);
        }
      });

      // Export clips by category
      for (const categoryId of params.categoryIds) {
        const clips = clipsByCategory.get(categoryId) || [];
        const category = categories.find(c => c.id === categoryId);

        if (!category || clips.length === 0) continue;

        // Create category folder
        const categoryDir = path.join(exportDir, category.name);
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

// Project operations
ipcMain.handle(
  "create-project",
  async (
    _event,
    projectData: Omit<Project, "id" | "created_at" | "last_opened">
  ) => {
    try {
      return createProject(projectData);
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-project", async (_event, videoPath: string) => {
  try {
    return getProject(videoPath);
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
});

ipcMain.handle("get-projects", async () => {
  try {
    return getProjects();
  } catch (error) {
    console.error("Error getting projects:", error);
    return [];
  }
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

ipcMain.handle("delete-project", async (_event, id: number) => {
  try {
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
      } catch (fileError) {
        console.warn(`Failed to delete files for clip ${clip.id}:`, fileError);
        // Continue deleting other clips even if one fails
      }
    }

    // Delete project from database (CASCADE will delete clips and categories)
    deleteProject(id);
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

ipcMain.handle("delete-clip", async (_event, id: number) => {
  try {
    // Get clip info to delete file
    const clips = getClips();
    const clip = clips.find(c => c.id === id);

    if (clip) {
      // Delete video file
      if (fs.existsSync(clip.output_path)) {
        fs.unlinkSync(clip.output_path);
      }
      // Delete thumbnail if it exists
      if (clip.thumbnail_path && fs.existsSync(clip.thumbnail_path)) {
        fs.unlinkSync(clip.thumbnail_path);
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
    if (fs.existsSync(clipPath)) {
      shell.openPath(clipPath);
    }
  } catch (error) {
    console.error("Error playing clip:", error);
  }
});

ipcMain.handle("get-clips-by-category", async (_event, categoryId: number) => {
  try {
    return getClipsByCategory(categoryId);
  } catch (error) {
    console.error("Error getting clips by category:", error);
    return [];
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

      const clips = getClips(projectId);
      const categories = getCategories(projectId);
      const categoryMap = new Map<number, string>();
      categories.forEach(cat => categoryMap.set(cat.id!, cat.name));

      const ext = path.extname(result.filePath).toLowerCase();
      if (ext !== ".csv" && ext !== ".json") {
        return null;
      }
      const isCSV = ext === ".csv";

      if (isCSV) {
        const header = "Title,Categories,Start Time,End Time,Duration,Notes,Created At";
        const rows = clips.map(clip => {
          let categoryNames: string[] = [];
          try {
            const ids = JSON.parse(clip.categories) as number[];
            categoryNames = ids.map(id => categoryMap.get(id) || "Unknown");
          } catch { /* empty */ }

          const escapeCsv = (val: string) => {
            const safeVal = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
            if (/[,"\n\r]/.test(safeVal)) {
              return `"${safeVal.replace(/"/g, '""')}"`;
            }
            return safeVal;
          };

          return [
            escapeCsv(clip.title),
            escapeCsv(categoryNames.join("; ")),
            clip.start_time.toFixed(2),
            clip.end_time.toFixed(2),
            clip.duration.toFixed(2),
            escapeCsv(clip.notes || ""),
            clip.created_at || "",
          ].join(",");
        });

        fs.writeFileSync(result.filePath, [header, ...rows].join("\n"), "utf-8");
      } else {
        const data = clips.map(clip => {
          let categoryNames: string[] = [];
          try {
            const ids = JSON.parse(clip.categories) as number[];
            categoryNames = ids.map(id => categoryMap.get(id) || "Unknown");
          } catch { /* empty */ }

          return {
            title: clip.title,
            categories: categoryNames,
            start_time: clip.start_time,
            end_time: clip.end_time,
            duration: clip.duration,
            notes: clip.notes || "",
            created_at: clip.created_at || "",
          };
        });

        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf-8");
      }

      return { filePath: result.filePath, count: clips.length };
    } catch (error) {
      console.error("Error exporting clips data:", error);
      throw error;
    }
  }
);

// Save analysis session as JSON
ipcMain.handle("save-session", async (_event, projectId: number) => {
  try {
    const project = getProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const clips = getClips(projectId);
    const categories = getCategoriesHierarchical(projectId);

    // Build category name map for resolving clip category IDs to names
    const categoryMap = new Map<number, string>();
    categories.forEach(cat => {
      if (cat.id) categoryMap.set(cat.id, cat.name);
      if (cat.children) {
        cat.children.forEach((child: Category) => {
          if (child.id) categoryMap.set(child.id, child.name);
        });
      }
    });

    // Build export data with names instead of IDs
    const exportCategories = categories.flatMap(cat => {
      const result = [{ name: cat.name, color: cat.color, description: cat.description || "", parentName: null as string | null }];
      if (cat.children) {
        cat.children.forEach((child: Category) => {
          result.push({ name: child.name, color: child.color, description: child.description || "", parentName: cat.name });
        });
      }
      return result;
    });

    const exportClips = clips.map(clip => {
      let categoryNames: string[] = [];
      try {
        const ids = JSON.parse(clip.categories) as number[];
        categoryNames = ids.map(id => categoryMap.get(id) || "Unknown");
      } catch { /* empty */ }

      return {
        title: clip.title,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration,
        categories: categoryNames,
        notes: clip.notes || "",
      };
    });

    const sessionData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        videoName: project.video_name,
        description: project.description || "",
      },
      categories: exportCategories,
      clips: exportClips,
    };

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

// Load analysis session from JSON
ipcMain.handle("load-session", async () => {
  try {
    // Step 1: Pick session JSON file
    const jsonResult = await dialog.showOpenDialog(mainWindow, {
      title: "Load Analysis Session",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (jsonResult.canceled || jsonResult.filePaths.length === 0) return null;

    const jsonContent = fs.readFileSync(jsonResult.filePaths[0], "utf-8");
    const sessionData = JSON.parse(jsonContent);

    // Validate structure
    if (!sessionData.version || !sessionData.project || !sessionData.categories || !sessionData.clips) {
      throw new Error("INVALID_SESSION_FILE");
    }

    // Step 2: Pick video file
    const videoResult = await dialog.showOpenDialog(mainWindow, {
      title: "Select Video File for This Session",
      properties: ["openFile"],
      filters: [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm", "m4v"] }],
    });

    if (videoResult.canceled || videoResult.filePaths.length === 0) return null;

    const videoPath = videoResult.filePaths[0];
    const videoName = path.basename(videoPath);

    // Step 3: Create project
    const project = createProject({
      name: sessionData.project.name,
      video_path: videoPath,
      video_name: videoName,
      description: sessionData.project.description || undefined,
    });

    // Step 4: Create categories (two-pass: parents first, then children)
    const categoryNameToId = new Map<string, number>();

    // Pass 1: Parents
    for (const cat of sessionData.categories) {
      if (!cat.parentName) {
        const created = createCategory({
          name: cat.name,
          color: cat.color,
          description: cat.description || undefined,
          project_id: project.id as number,
        });
        if (created.id) categoryNameToId.set(cat.name, created.id);
      }
    }

    // Pass 2: Children
    for (const cat of sessionData.categories) {
      if (cat.parentName) {
        const parentId = categoryNameToId.get(cat.parentName);
        const created = createCategory({
          name: cat.name,
          color: cat.color,
          description: cat.description || undefined,
          parent_id: parentId,
          project_id: project.id as number,
        });
        if (created.id) categoryNameToId.set(cat.name, created.id);
      }
    }

    // Step 5: Create clip metadata
    for (const clip of sessionData.clips) {
      const categoryIds = clip.categories
        .map((name: string) => categoryNameToId.get(name))
        .filter((id: number | undefined): id is number => id !== undefined);

      createClip({
        project_id: project.id as number,
        video_path: videoPath,
        output_path: "",
        thumbnail_path: "",
        start_time: clip.startTime,
        end_time: clip.endTime,
        duration: clip.duration,
        title: clip.title,
        categories: JSON.stringify(categoryIds),
        notes: clip.notes || undefined,
      });
    }

    return { success: true, project };
  } catch (error) {
    console.error("Error loading session:", error);
    throw error;
  }
});

// Resolve bundled yt-dlp binary path (handles ASAR unpacking)
const getYtdlpPath = (): string => {
  const { YOUTUBE_DL_PATH } = require("youtube-dl-exec/src/constants");
  return fixAsarPath(YOUTUBE_DL_PATH);
};

// Download YouTube video using bundled yt-dlp
ipcMain.handle("download-youtube-video", async (_event, url: string) => {
  // Validate YouTube URL
  const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/;
  if (!ytRegex.test(url)) {
    throw new Error("INVALID_YOUTUBE_URL");
  }

  const downloadsDir = path.join(app.getPath("userData"), "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const ytdlpPath = getYtdlpPath();

  return new Promise<{ filePath: string; fileName: string; success: boolean }>((resolve, reject) => {
    let outputFilePath = "";

    const ytdlp = spawn(ytdlpPath, [
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", path.join(downloadsDir, "%(title)s.%(ext)s"),
      "--no-playlist",
      "--newline",
      url,
    ]);

    ytdlp.stdout.on("data", (data: Buffer) => {
      const line = data.toString();

      // Parse progress
      const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        mainWindow?.webContents.send("youtube-download-progress", {
          percent,
          status: "downloading",
        });
      }

      // Capture output file path
      const destMatch = line.match(/\[download\] Destination: (.+)/);
      if (destMatch) {
        outputFilePath = destMatch[1].trim();
      }

      const mergerMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
      if (mergerMatch) {
        outputFilePath = mergerMatch[1].trim();
      }
    });

    ytdlp.stderr.on("data", (data: Buffer) => {
      console.error("yt-dlp stderr:", data.toString());
    });

    ytdlp.on("close", (code) => {
      if (code === 0 && outputFilePath) {
        const fileName = path.basename(outputFilePath);
        resolve({ filePath: outputFilePath, fileName, success: true });
      } else if (code === 0) {
        // Try to find the downloaded file
        const files = fs.readdirSync(downloadsDir)
          .filter(f => f.endsWith(".mp4"))
          .map(f => ({ name: f, time: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 0) {
          const filePath = path.join(downloadsDir, files[0].name);
          resolve({ filePath, fileName: files[0].name, success: true });
        } else {
          reject(new Error("DOWNLOAD_FAILED"));
        }
      } else {
        reject(new Error("DOWNLOAD_FAILED"));
      }
    });

    ytdlp.on("error", () => {
      reject(new Error("DOWNLOAD_FAILED"));
    });
  });
});
