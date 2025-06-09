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
        const outputPath = path.join(clipsDir, outputFileName);

        const duration = endTime - startTime;

        // Cut video using FFmpeg
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(duration)
          .output(outputPath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .on("end", () => {
            try {
              // Save clip to database
              const clipData = {
                video_path: inputPath,
                output_path: outputPath,
                start_time: startTime,
                end_time: endTime,
                duration: duration,
                title: title,
                categories: JSON.stringify(categories),
                notes: notes,
              };

              const savedClip = createClip(clipData);

              // Send progress update
              mainWindow.webContents.send("clip-created", savedClip);

              resolve({
                success: true,
                clip: savedClip,
                outputPath: outputPath,
              });
            } catch (dbError) {
              console.error("Database error:", dbError);
              reject(dbError);
            }
          })
          .on("error", error => {
            console.error("FFmpeg error:", error);
            reject(error);
          })
          .on("progress", progress => {
            // Send progress updates to renderer
            mainWindow.webContents.send("clip-progress", {
              percent: progress.percent || 0,
              timemark: progress.timemark,
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
  async (_event, categoryIds: number[]) => {
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

      for (const categoryId of categoryIds) {
        const clips = getClipsByCategory(categoryId);
        const categories = getCategories();
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

    if (clip && fs.existsSync(clip.output_path)) {
      fs.unlinkSync(clip.output_path);
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
