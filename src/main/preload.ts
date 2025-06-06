import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  selectVideoFile: () => Promise<string | null>;
  saveTag: (tag: any) => Promise<any>;
  deleteTag: (tagId: number) => Promise<boolean>;
  loadTags: (videoPath: string) => Promise<any[]>;
  createClip: (clip: any) => Promise<any>;
  loadClips: (videoPath: string) => Promise<any[]>;
  exportClipsData: (data: any) => Promise<string | null>;
}

const electronAPI: ElectronAPI = {
  selectVideoFile: () => ipcRenderer.invoke("select-video-file"),
  saveTag: (tag: any) => ipcRenderer.invoke("save-tag", tag),
  deleteTag: (tagId: number) => ipcRenderer.invoke("delete-tag", tagId),
  loadTags: (videoPath: string) => ipcRenderer.invoke("load-tags", videoPath),
  createClip: (clip: any) => ipcRenderer.invoke("create-clip", clip),
  loadClips: (videoPath: string) => ipcRenderer.invoke("load-clips", videoPath),
  exportClipsData: (data: any) => ipcRenderer.invoke("export-clips-data", data),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Add type declaration for global scope
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
