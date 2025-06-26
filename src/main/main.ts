import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { v4 as uuidv4 } from "uuid";
import {
  setupDatabase,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getClips,
  createClip,
  updateClip,
  deleteClip,
  getClipsByCategory,
  Category,
  Clip,
  resetDatabase,
  getKeyBindings,
  setKeyBinding,
  KeyBindings,
  savePreset,
  loadPreset,
  getPresets,
} from "./database";

// Set FFmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

let mainWindow: BrowserWindow;

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
  });

  mainWindow.on("closed", () => {
    app.quit();
  });
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
  const clipsDir = path.join(documentsDir, "Basketball Clip Cutter", "clips");
  return clipsDir;
};

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
    }
  ) => {
    return new Promise((resolve, reject) => {
      try {
        const { inputPath, startTime, endTime, title, categories, notes } =
          params;

        // Normalize all paths for Windows
        const normalizedInputPath = path
          .normalize(inputPath)
          .replace(/\\/g, "/");
        const clipsDir = getClipsDirectory();
        const normalizedClipsDir = path.normalize(clipsDir).replace(/\\/g, "/");

        // Ensure clips directory exists
        if (!fs.existsSync(normalizedClipsDir)) {
          try {
            fs.mkdirSync(normalizedClipsDir, { recursive: true });
          } catch (err) {
            const error = err as Error;
            console.error("Error creating clips directory:", error);
            reject(
              new Error(
                `Failed to create clips directory in Documents folder. Error: ${error.message}`
              )
            );
            return;
          }
        }

        // Generate unique filename with Windows-safe characters
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const clipId = uuidv4().slice(0, 8);
        const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
        const outputFileName = `${safeTitle}_${timestamp}_${clipId}.mp4`;
        const thumbnailFileName = `${safeTitle}_${timestamp}_${clipId}_thumb.jpg`;
        const outputPath = path
          .join(normalizedClipsDir, outputFileName)
          .replace(/\\/g, "/");
        const thumbnailPath = path
          .join(normalizedClipsDir, thumbnailFileName)
          .replace(/\\/g, "/");
        const duration = endTime - startTime;

        // Validate that input file exists and is accessible
        if (!fs.existsSync(normalizedInputPath)) {
          console.error("Input file does not exist:", normalizedInputPath);
          reject(new Error("Input file does not exist"));
          return;
        }

        // Check if we have write access to the clips directory
        try {
          fs.accessSync(normalizedClipsDir, fs.constants.W_OK);
        } catch (error) {
          console.error("No write access to clips directory:", error);
          reject(
            new Error(
              `Cannot write to clips directory at ${normalizedClipsDir}. Please check your Documents folder permissions.`
            )
          );
          return;
        }

        // Check if there's enough disk space (rough estimate - 2x input file size)
        try {
          const inputStats = fs.statSync(normalizedInputPath);
          const estimatedSize = inputStats.size * 2; // Conservative estimate
          const { free } =
            process.platform === "win32"
              ? require("fs").statfsSync(normalizedClipsDir.split("/")[0] + "/") // Get root drive stats on Windows
              : require("fs").statfsSync(normalizedClipsDir);

          if (free < estimatedSize) {
            reject(new Error("Not enough disk space to create the clip"));
            return;
          }
        } catch (error) {
          console.warn("Could not check disk space:", error);
          // Continue anyway, FFmpeg will fail if there's not enough space
        }

        console.log("Starting thumbnail creation...");
        const ffmpegPath = require("ffmpeg-static");
        console.log("Using FFmpeg from:", ffmpegPath);

        // First, generate the thumbnail
        ffmpeg(normalizedInputPath)
          .setFfmpegPath(ffmpegPath)
          .setStartTime(startTime)
          .frames(1)
          .outputOptions(["-y"]) // Overwrite output files
          .output(thumbnailPath)
          .on("start", commandLine => {
            console.log("Thumbnail FFmpeg command:", commandLine);
          })
          .on("error", error => {
            console.error("Thumbnail creation error:", error);
            reject(new Error(`Failed to create thumbnail: ${error.message}`));
          })
          .on("end", () => {
            console.log("Thumbnail created successfully");

            // After thumbnail is created, create the clip
            console.log("Starting clip creation...");
            ffmpeg(normalizedInputPath)
              .setFfmpegPath(ffmpegPath)
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
              .output(outputPath)
              .on("start", commandLine => {
                console.log("Clip FFmpeg command:", commandLine);
              })
              .on("end", () => {
                try {
                  console.log("Clip created successfully");
                  // Save clip to database with thumbnail path
                  const clipData = {
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
                  reject(dbError);
                }
              })
              .on("error", error => {
                console.error("FFmpeg clip creation error:", error);
                reject(error);
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
    if (fs.existsSync(clipsDir)) {
      shell.showItemInFolder(clipsDir);
    } else {
      shell.openPath(path.dirname(clipsDir)); // Open the parent "Basketball Clip Cutter" folder
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
      const categories = getCategories();

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
ipcMain.handle("get-categories", async () => {
  try {
    return getCategories();
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
});

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

// Clip operations
ipcMain.handle("get-clips", async (_event, videoPath?: string) => {
  try {
    return getClips(videoPath);
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
