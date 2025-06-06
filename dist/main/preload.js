"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    selectVideoFile: () => electron_1.ipcRenderer.invoke("select-video-file"),
    saveTag: (tag) => electron_1.ipcRenderer.invoke("save-tag", tag),
    deleteTag: (tagId) => electron_1.ipcRenderer.invoke("delete-tag", tagId),
    loadTags: (videoPath) => electron_1.ipcRenderer.invoke("load-tags", videoPath),
    createClip: (clip) => electron_1.ipcRenderer.invoke("create-clip", clip),
    loadClips: (videoPath) => electron_1.ipcRenderer.invoke("load-clips", videoPath),
    exportClipsData: (data) => electron_1.ipcRenderer.invoke("export-clips-data", data),
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=preload.js.map