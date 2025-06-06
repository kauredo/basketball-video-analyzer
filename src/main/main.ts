import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import {
  setupDatabase,
  saveTag,
  deleteTag,
  loadTags,
  createClip,
  loadClips,
} from "./database";

// Enable live reload for development
if (process.env.NODE_ENV === "development") {
  try {
    require("electron-reload")(__dirname, {
      electron: path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        ".bin",
        "electron"
      ),
      hardResetMethod: "exit",
    });
  } catch (_) {
    // Ignore electron-reload errors in production
  }
}

let mainWindow: BrowserWindow;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // Allow local file access
    },
    titleBarStyle: "default",
    show: false,
  });

  // Load the HTML file
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Open dev tools in development
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

// IPC handlers
ipcMain.handle("select-video-file", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        { name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
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

ipcMain.handle("save-tag", async (_event, tag) => {
  try {
    const savedTag = saveTag(tag);
    return savedTag;
  } catch (error) {
    console.error("Error saving tag:", error);
    throw error;
  }
});

ipcMain.handle("delete-tag", async (_event, tagId: number) => {
  try {
    deleteTag(tagId);
    return true;
  } catch (error) {
    console.error("Error deleting tag:", error);
    throw error;
  }
});

ipcMain.handle("load-tags", async (_event, videoPath: string) => {
  try {
    const tags = loadTags(videoPath);
    return tags;
  } catch (error) {
    console.error("Error loading tags:", error);
    return [];
  }
});

ipcMain.handle("create-clip", async (_event, clip) => {
  try {
    const savedClip = createClip(clip);
    return savedClip;
  } catch (error) {
    console.error("Error creating clip:", error);
    throw error;
  }
});

ipcMain.handle("load-clips", async (_event, videoPath: string) => {
  try {
    const clips = loadClips(videoPath);
    return clips;
  } catch (error) {
    console.error("Error loading clips:", error);
    return [];
  }
});

ipcMain.handle("export-clips-data", async (_event, data: any) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: "JSON", extensions: ["json"] },
        { name: "CSV", extensions: ["csv"] },
      ],
      defaultPath: "basketball-analysis.json",
    });

    if (!result.canceled && result.filePath) {
      const fs = require("fs");
      if (result.filePath.endsWith(".csv")) {
        // Convert to CSV format
        const csvContent = convertToCSV(data);
        fs.writeFileSync(result.filePath, csvContent);
      } else {
        // Save as JSON
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      }
      return result.filePath;
    }
    return null;
  } catch (error) {
    console.error("Error exporting data:", error);
    throw error;
  }
});

function convertToCSV(data: any): string {
  if (!data.tags || data.tags.length === 0) return "No tags to export";

  const headers = ["Timestamp", "Tag Type", "Description", "Player"];
  const rows = data.tags.map((tag: any) => [
    tag.timestamp.toFixed(2),
    tag.tag_type,
    tag.description || "",
    tag.player || "",
  ]);

  return [headers, ...rows]
    .map(row => row.map((field: any) => `"${field}"`).join(","))
    .join("\n");
}
