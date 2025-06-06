"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
// Enable live reload for development
if (process.env.NODE_ENV === "development") {
    try {
        require("electron-reload")(__dirname, {
            electron: path_1.default.join(__dirname, "..", "..", "node_modules", ".bin", "electron"),
            hardResetMethod: "exit",
        });
    }
    catch (_) {
        // Ignore electron-reload errors in production
    }
}
let mainWindow;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        height: 900,
        width: 1400,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, "preload.js"),
            webSecurity: false, // Allow local file access
        },
        titleBarStyle: "default",
        show: false,
    });
    // Load the HTML file
    mainWindow.loadFile(path_1.default.join(__dirname, "../renderer/index.html"));
    // Open dev tools in development
    if (process.env.NODE_ENV === "development") {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
    mainWindow.on("closed", () => {
        electron_1.app.quit();
    });
};
electron_1.app.whenReady().then(() => {
    (0, database_1.setupDatabase)();
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
// IPC handlers
electron_1.ipcMain.handle("select-video-file", async () => {
    try {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: [
                { name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
            ],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    }
    catch (error) {
        console.error("Error selecting video file:", error);
        return null;
    }
});
electron_1.ipcMain.handle("save-tag", async (_event, tag) => {
    try {
        const savedTag = (0, database_1.saveTag)(tag);
        return savedTag;
    }
    catch (error) {
        console.error("Error saving tag:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("delete-tag", async (_event, tagId) => {
    try {
        (0, database_1.deleteTag)(tagId);
        return true;
    }
    catch (error) {
        console.error("Error deleting tag:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("load-tags", async (_event, videoPath) => {
    try {
        const tags = (0, database_1.loadTags)(videoPath);
        return tags;
    }
    catch (error) {
        console.error("Error loading tags:", error);
        return [];
    }
});
electron_1.ipcMain.handle("create-clip", async (_event, clip) => {
    try {
        const savedClip = (0, database_1.createClip)(clip);
        return savedClip;
    }
    catch (error) {
        console.error("Error creating clip:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("load-clips", async (_event, videoPath) => {
    try {
        const clips = (0, database_1.loadClips)(videoPath);
        return clips;
    }
    catch (error) {
        console.error("Error loading clips:", error);
        return [];
    }
});
electron_1.ipcMain.handle("export-clips-data", async (_event, data) => {
    try {
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
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
            }
            else {
                // Save as JSON
                fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
            }
            return result.filePath;
        }
        return null;
    }
    catch (error) {
        console.error("Error exporting data:", error);
        throw error;
    }
});
function convertToCSV(data) {
    if (!data.tags || data.tags.length === 0)
        return "No tags to export";
    const headers = ["Timestamp", "Tag Type", "Description", "Player"];
    const rows = data.tags.map((tag) => [
        tag.timestamp.toFixed(2),
        tag.tag_type,
        tag.description || "",
        tag.player || "",
    ]);
    return [headers, ...rows]
        .map(row => row.map((field) => `"${field}"`).join(","))
        .join("\n");
}
//# sourceMappingURL=main.js.map