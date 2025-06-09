"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    // Video operations
    selectVideoFile: () => electron_1.ipcRenderer.invoke("select-video-file"),
    cutVideoClip: params => electron_1.ipcRenderer.invoke("cut-video-clip", params),
    openClipFolder: () => electron_1.ipcRenderer.invoke("open-clip-folder"),
    playClip: clipPath => electron_1.ipcRenderer.invoke("play-clip", clipPath),
    exportClipsByCategory: categoryIds => electron_1.ipcRenderer.invoke("export-clips-by-category", categoryIds),
    // Category operations
    getCategories: () => electron_1.ipcRenderer.invoke("get-categories"),
    createCategory: category => electron_1.ipcRenderer.invoke("create-category", category),
    updateCategory: (id, updates) => electron_1.ipcRenderer.invoke("update-category", id, updates),
    deleteCategory: id => electron_1.ipcRenderer.invoke("delete-category", id),
    // Clip operations
    getClips: videoPath => electron_1.ipcRenderer.invoke("get-clips", videoPath),
    updateClip: (id, updates) => electron_1.ipcRenderer.invoke("update-clip", id, updates),
    deleteClip: id => electron_1.ipcRenderer.invoke("delete-clip", id),
    getClipsByCategory: categoryId => electron_1.ipcRenderer.invoke("get-clips-by-category", categoryId),
    // Event listeners
    onClipProgress: callback => {
        electron_1.ipcRenderer.on("clip-progress", (_event, data) => callback(data));
    },
    onClipCreated: callback => {
        electron_1.ipcRenderer.on("clip-created", (_event, clip) => callback(clip));
    },
    removeAllListeners: channel => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    },
    resetDatabase: () => electron_1.ipcRenderer.invoke("reset-database"),
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=preload.js.map