import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
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

// Set FFmpeg path
if (ffmpegStatic) {
  // Ensure the path is properly formatted for the OS
  const ffmpegPath = path.normalize(ffmpegStatic);
  console.log("FFmpeg path:", ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.error("FFmpeg static path not found!");
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

// Get clips directory in user's Documents
const getClipsDirectory = () => {
  // Use Documents folder instead of AppData
  const documentsDir = app.getPath("documents");
  const clipsDir = path.join(
    documentsDir,
    "Basketball Video Analyzer",
    "clips"
  );
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
    const documentsDir = path.dirname(clipsDir);

    try {
      if (!fs.existsSync(documentsDir)) {
        issues.push("ERROR_DOCUMENTS_NOT_ACCESSIBLE");
      } else {
        // Test write access
        const testFile = path.join(documentsDir, ".test-write");
        try {
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);
        } catch {
          issues.push("ERROR_NO_WRITE_ACCESS");
        }
      }
    } catch (error) {
      issues.push("ERROR_DOCUMENTS_NOT_ACCESSIBLE");
    }

    // Check available disk space (if possible)
    try {
      if (process.platform !== "win32" && fs.existsSync(documentsDir)) {
        const stats = require("fs").statfsSync(documentsDir);
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

        // On Windows, keep native backslashes and let fluent-ffmpeg handle escaping
        // Only convert to forward slashes on non-Windows platforms
        const isWindows = process.platform === "win32";
        const ffmpegInputPath = isWindows
          ? normalizedInputPath
          : normalizedInputPath.replace(/\\/g, "/");
        const ffmpegOutputPath = isWindows
          ? outputPath
          : outputPath.replace(/\\/g, "/");
        const ffmpegThumbnailPath = isWindows
          ? thumbnailPath
          : thumbnailPath.replace(/\\/g, "/");

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

        const ffmpegPath = ffmpegStatic;
        console.log("Using FFmpeg from:", ffmpegPath);

        // Generate process ID for cancellation support
        const processId = uuidv4().slice(0, 8);
        mainWindow.webContents.send("clip-process-id", { processId });

        // First, generate the thumbnail
        const thumbnailCommand = ffmpeg(ffmpegInputPath);

        if (ffmpegPath) {
          thumbnailCommand.setFfmpegPath(ffmpegPath);
        }

        thumbnailCommand
          .setStartTime(startTime)
          .frames(1)
          .outputOptions(["-y"]) // Overwrite output files
          .output(ffmpegThumbnailPath)
          .on("start", commandLine => {
            console.log("Thumbnail FFmpeg command:", commandLine);
            // Store the thumbnail process for potential cancellation
            activeClipProcesses.set(`${processId}-thumb`, thumbnailCommand);
          })
          .on("error", error => {
            console.error("Thumbnail creation error:", error);
            activeClipProcesses.delete(`${processId}-thumb`);
            reject(new Error("ERROR_THUMBNAIL_FAILED"));
          })
          .on("end", () => {
            activeClipProcesses.delete(`${processId}-thumb`);
            console.log("Thumbnail created successfully");

            // After thumbnail is created, create the clip
            console.log("Starting clip creation...");
            const clipCommand = ffmpeg(ffmpegInputPath);

            if (ffmpegPath) {
              clipCommand.setFfmpegPath(ffmpegPath);
            }

            clipCommand
              .setStartTime(startTime)
              .setDuration(duration)
              .outputOptions([
                "-y", // Overwrite output files
                "-movflags",
                "+faststart", // Optimize for web playback
                "-c:v",
                "libx264", // Use H.264 codec
                "-preset",
                "medium", // Balance between speed and quality
                "-c:a",
                "aac", // Use AAC audio codec
                "-strict",
                "experimental", // Required for some Windows configurations
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
            const fileName = path.basename(clip.output_path);
            const destPath = path.join(categoryDir, fileName);
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
    // Delete all clip files
    const clipsDir = path.join(app.getPath("userData"), "clips");
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
