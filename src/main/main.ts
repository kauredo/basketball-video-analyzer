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

        // Normalize input path for Windows
        const normalizedInputPath = path.normalize(inputPath);

        // Create clips directory
        const clipsDir = path.join(app.getPath("userData"), "clips");
        if (!fs.existsSync(clipsDir)) {
          fs.mkdirSync(clipsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const clipId = uuidv4().slice(0, 8);
        const outputFileName = `${title.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_${timestamp}_${clipId}.mp4`;
        const thumbnailFileName = `${title.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_${timestamp}_${clipId}_thumb.jpg`;
        const outputPath = path.join(clipsDir, outputFileName);
        const thumbnailPath = path.join(clipsDir, thumbnailFileName);
        const duration = endTime - startTime;

        // Validate that input file exists and is accessible
        if (!fs.existsSync(normalizedInputPath)) {
          console.error("Input file does not exist:", normalizedInputPath);
          reject(new Error("Input file does not exist"));
          return;
        }

        // Check if we have write access to the clips directory
        try {
          fs.accessSync(clipsDir, fs.constants.W_OK);
        } catch (error) {
          console.error("No write access to clips directory:", error);
          reject(new Error("No write access to clips directory"));
          return;
        }

        // First, generate the thumbnail
        console.log("Starting thumbnail creation...");
        ffmpeg(normalizedInputPath)
          .setStartTime(startTime)
          .frames(1)
          .output(thumbnailPath)
          .on("start", commandLine => {
            console.log("Thumbnail FFmpeg command:", commandLine);
          })
          .on("end", () => {
            console.log("Thumbnail created successfully");
            // After thumbnail is created, create the clip
            console.log("Starting clip creation...");
            ffmpeg(normalizedInputPath)
              .setStartTime(startTime)
              .setDuration(duration)
              .output(outputPath)
              .videoCodec("libx264")
              .audioCodec("aac")
              .outputOptions(["-movflags", "+faststart"]) // Optimize for web playback
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
          .on("error", error => {
            console.error("Thumbnail creation error:", error);
            reject(error);
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
    const clipsDir = path.join(app.getPath("userData"), "clips");
    if (fs.existsSync(clipsDir)) {
      shell.showItemInFolder(clipsDir);
    } else {
      shell.openPath(app.getPath("userData"));
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
