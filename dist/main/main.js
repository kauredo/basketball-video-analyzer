"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const uuid_1 = require("uuid");
const database_1 = require("./database");
// Set FFmpeg path
if (ffmpeg_static_1.default) {
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
}
let mainWindow;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        height: 1000,
        width: 1600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, "preload.js"),
            webSecurity: false,
        },
        titleBarStyle: "default",
        show: false,
    });
    mainWindow.loadFile(path_1.default.join(__dirname, "../renderer/index.html"));
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
// Video file operations
electron_1.ipcMain.handle("select-video-file", async () => {
    try {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
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
    }
    catch (error) {
        console.error("Error selecting video file:", error);
        return null;
    }
});
electron_1.ipcMain.handle("cut-video-clip", async (_event, params) => {
    return new Promise((resolve, reject) => {
        try {
            const { inputPath, startTime, endTime, title, categories, notes } = params;
            // Create clips directory
            const clipsDir = path_1.default.join(electron_1.app.getPath("userData"), "clips");
            if (!fs_1.default.existsSync(clipsDir)) {
                fs_1.default.mkdirSync(clipsDir, { recursive: true });
            }
            // Generate unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const clipId = (0, uuid_1.v4)().slice(0, 8);
            const outputFileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}_${clipId}.mp4`;
            const thumbnailFileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}_${clipId}_thumb.jpg`;
            const outputPath = path_1.default.join(clipsDir, outputFileName);
            const thumbnailPath = path_1.default.join(clipsDir, thumbnailFileName);
            const duration = endTime - startTime;
            // First, generate the thumbnail
            (0, fluent_ffmpeg_1.default)(inputPath)
                .setStartTime(startTime)
                .frames(1)
                .output(thumbnailPath)
                .on("end", () => {
                // After thumbnail is created, create the clip
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .setStartTime(startTime)
                    .setDuration(duration)
                    .output(outputPath)
                    .videoCodec("libx264")
                    .audioCodec("aac")
                    .on("end", () => {
                    try {
                        // Save clip to database with thumbnail path
                        const clipData = {
                            video_path: inputPath,
                            output_path: outputPath,
                            thumbnail_path: thumbnailPath,
                            start_time: startTime,
                            end_time: endTime,
                            duration: duration,
                            title: title,
                            categories: JSON.stringify(categories),
                            notes: notes,
                        };
                        const savedClip = (0, database_1.createClip)(clipData);
                        mainWindow.webContents.send("clip-created", savedClip);
                        resolve({
                            success: true,
                            clip: savedClip,
                            outputPath: outputPath,
                            thumbnailPath: thumbnailPath,
                        });
                    }
                    catch (dbError) {
                        console.error("Database error:", dbError);
                        reject(dbError);
                    }
                })
                    .on("error", error => {
                    console.error("FFmpeg error:", error);
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
        }
        catch (error) {
            console.error("Error cutting video clip:", error);
            reject(error);
        }
    });
});
electron_1.ipcMain.handle("open-clip-folder", async () => {
    try {
        const clipsDir = path_1.default.join(electron_1.app.getPath("userData"), "clips");
        if (fs_1.default.existsSync(clipsDir)) {
            electron_1.shell.showItemInFolder(clipsDir);
        }
        else {
            electron_1.shell.openPath(electron_1.app.getPath("userData"));
        }
    }
    catch (error) {
        console.error("Error opening clip folder:", error);
    }
});
electron_1.ipcMain.handle("export-clips-by-category", async (_event, categoryIds) => {
    try {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
            title: "Select Export Directory",
        });
        if (result.canceled || !result.filePaths.length) {
            return null;
        }
        const exportDir = result.filePaths[0];
        const exportedFiles = [];
        for (const categoryId of categoryIds) {
            const clips = (0, database_1.getClipsByCategory)(categoryId);
            const categories = (0, database_1.getCategories)();
            const category = categories.find(c => c.id === categoryId);
            if (!category || clips.length === 0)
                continue;
            // Create category folder
            const categoryDir = path_1.default.join(exportDir, category.name);
            if (!fs_1.default.existsSync(categoryDir)) {
                fs_1.default.mkdirSync(categoryDir, { recursive: true });
            }
            // Copy clips to category folder
            for (const clip of clips) {
                if (fs_1.default.existsSync(clip.output_path)) {
                    const fileName = path_1.default.basename(clip.output_path);
                    const destPath = path_1.default.join(categoryDir, fileName);
                    fs_1.default.copyFileSync(clip.output_path, destPath);
                    exportedFiles.push(destPath);
                }
            }
        }
        return {
            exportDir,
            exportedFiles,
            count: exportedFiles.length,
        };
    }
    catch (error) {
        console.error("Error exporting clips:", error);
        throw error;
    }
});
// Category operations
electron_1.ipcMain.handle("get-categories", async () => {
    try {
        return (0, database_1.getCategories)();
    }
    catch (error) {
        console.error("Error getting categories:", error);
        return [];
    }
});
electron_1.ipcMain.handle("create-category", async (_event, category) => {
    try {
        return (0, database_1.createCategory)(category);
    }
    catch (error) {
        console.error("Error creating category:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("update-category", async (_event, id, updates) => {
    try {
        (0, database_1.updateCategory)(id, updates);
        return true;
    }
    catch (error) {
        console.error("Error updating category:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("delete-category", async (_event, id) => {
    try {
        (0, database_1.deleteCategory)(id);
        return true;
    }
    catch (error) {
        console.error("Error deleting category:", error);
        throw error;
    }
});
// Clip operations
electron_1.ipcMain.handle("get-clips", async (_event, videoPath) => {
    try {
        return (0, database_1.getClips)(videoPath);
    }
    catch (error) {
        console.error("Error getting clips:", error);
        return [];
    }
});
electron_1.ipcMain.handle("update-clip", async (_event, id, updates) => {
    try {
        (0, database_1.updateClip)(id, updates);
        return true;
    }
    catch (error) {
        console.error("Error updating clip:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("delete-clip", async (_event, id) => {
    try {
        // Get clip info to delete file
        const clips = (0, database_1.getClips)();
        const clip = clips.find(c => c.id === id);
        if (clip) {
            // Delete video file
            if (fs_1.default.existsSync(clip.output_path)) {
                fs_1.default.unlinkSync(clip.output_path);
            }
            // Delete thumbnail if it exists
            if (clip.thumbnail_path && fs_1.default.existsSync(clip.thumbnail_path)) {
                fs_1.default.unlinkSync(clip.thumbnail_path);
            }
        }
        (0, database_1.deleteClip)(id);
        return true;
    }
    catch (error) {
        console.error("Error deleting clip:", error);
        throw error;
    }
});
electron_1.ipcMain.handle("play-clip", async (_event, clipPath) => {
    try {
        if (fs_1.default.existsSync(clipPath)) {
            electron_1.shell.openPath(clipPath);
        }
    }
    catch (error) {
        console.error("Error playing clip:", error);
    }
});
electron_1.ipcMain.handle("get-clips-by-category", async (_event, categoryId) => {
    try {
        return (0, database_1.getClipsByCategory)(categoryId);
    }
    catch (error) {
        console.error("Error getting clips by category:", error);
        return [];
    }
});
electron_1.ipcMain.handle("reset-database", async () => {
    try {
        // Delete all clip files
        const clipsDir = path_1.default.join(electron_1.app.getPath("userData"), "clips");
        if (fs_1.default.existsSync(clipsDir)) {
            fs_1.default.rmSync(clipsDir, { recursive: true, force: true });
        }
        // Reset database
        (0, database_1.resetDatabase)();
        return true;
    }
    catch (error) {
        console.error("Error resetting application:", error);
        return false;
    }
});
//# sourceMappingURL=main.js.map