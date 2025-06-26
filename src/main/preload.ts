import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  // Video operations
  selectVideoFile: () => Promise<string | null>;
  cutVideoClip: (params: {
    inputPath: string;
    startTime: number;
    endTime: number;
    title: string;
    categories: number[];
    notes?: string;
  }) => Promise<any>;
  openClipFolder: () => Promise<void>;
  playClip: (clipPath: string) => Promise<void>;
  exportClipsByCategory: (params: {
    categoryIds: number[];
    clips: Array<{
      id: number;
      title: string;
      output_path: string;
      categories: string;
    }>;
  }) => Promise<{ count: number; exportDir: string }>;

  // Category operations
  getCategories: () => Promise<any[]>;
  createCategory: (category: any) => Promise<any>;
  updateCategory: (id: number, updates: any) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
  savePreset: (presetName: string, categories: any[]) => Promise<boolean>;
  loadPreset: (presetName: string) => Promise<any[]>;
  getPresets: () => Promise<string[]>;

  // Clip operations
  getClips: (videoPath?: string) => Promise<any[]>;
  updateClip: (id: number, updates: any) => Promise<boolean>;
  deleteClip: (id: number) => Promise<boolean>;
  getClipsByCategory: (categoryId: number) => Promise<any[]>;

  // Event listeners
  onClipProgress: (callback: (data: any) => void) => void;
  onClipCreated: (callback: (clip: any) => void) => void;
  onKeyBindingsChanged: (
    callback: (bindings: { markInKey: string; markOutKey: string }) => void
  ) => void;
  removeAllListeners: (channel: string) => void;
  resetDatabase: () => Promise<boolean>;

  // Settings operations
  getKeyBindings: () => Promise<{ markInKey: string; markOutKey: string }>;
  setKeyBinding: (params: {
    key: "markInKey" | "markOutKey";
    value: string;
  }) => Promise<void>;
}

const electronAPI: ElectronAPI = {
  // Video operations
  selectVideoFile: () => ipcRenderer.invoke("select-video-file"),
  cutVideoClip: params => ipcRenderer.invoke("cut-video-clip", params),
  openClipFolder: () => ipcRenderer.invoke("open-clip-folder"),
  playClip: clipPath => ipcRenderer.invoke("play-clip", clipPath),
  exportClipsByCategory: params =>
    ipcRenderer.invoke("export-clips-by-category", params),

  // Category operations
  getCategories: () => ipcRenderer.invoke("get-categories"),
  createCategory: category => ipcRenderer.invoke("create-category", category),
  updateCategory: (id, updates) =>
    ipcRenderer.invoke("update-category", id, updates),
  deleteCategory: id => ipcRenderer.invoke("delete-category", id),
  savePreset: (presetName, categories) =>
    ipcRenderer.invoke("save-preset", presetName, categories),
  loadPreset: presetName => ipcRenderer.invoke("load-preset", presetName),
  getPresets: () => ipcRenderer.invoke("get-presets"),

  // Clip operations
  getClips: videoPath => ipcRenderer.invoke("get-clips", videoPath),
  updateClip: (id, updates) => ipcRenderer.invoke("update-clip", id, updates),
  deleteClip: id => ipcRenderer.invoke("delete-clip", id),
  getClipsByCategory: categoryId =>
    ipcRenderer.invoke("get-clips-by-category", categoryId),

  // Event listeners
  onClipProgress: callback => {
    ipcRenderer.on("clip-progress", (_event, data) => callback(data));
  },
  onClipCreated: callback => {
    ipcRenderer.on("clip-created", (_event, clip) => callback(clip));
  },
  onKeyBindingsChanged: callback => {
    ipcRenderer.on("keyBindingsChanged", (_event, bindings) =>
      callback(bindings)
    );
  },
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  },
  resetDatabase: () => ipcRenderer.invoke("reset-database"),

  // Settings operations
  getKeyBindings: () => ipcRenderer.invoke("getKeyBindings"),
  setKeyBinding: params => ipcRenderer.invoke("setKeyBinding", params),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
