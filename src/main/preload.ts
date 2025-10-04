import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  // System operations
  systemCheck: () => Promise<{
    success: boolean;
    issues: string[];
    warnings: string[];
    system: {
      platform: string;
      arch: string;
      nodeVersion: string;
      ffmpegPath: string;
      clipsDirectory: string;
    } | null;
  }>;
  cancelClipCreation: (
    processId: string
  ) => Promise<{ success: boolean; reason?: string }>;

  // Video operations
  selectVideoFile: () => Promise<string | null>;
  cutVideoClip: (params: {
    inputPath: string;
    startTime: number;
    endTime: number;
    title: string;
    categories: number[];
    notes?: string;
    projectId: number;
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

  // Project operations
  createProject: (project: {
    name: string;
    video_path: string;
    video_name: string;
    description?: string;
  }) => Promise<any>;
  getProject: (videoPath: string) => Promise<any | null>;
  getProjects: () => Promise<any[]>;
  updateProjectLastOpened: (projectId: number) => Promise<boolean>;
  deleteProject: (id: number) => Promise<boolean>;

  // Category operations
  getCategories: (projectId: number) => Promise<any[]>;
  getCategoriesHierarchical: (projectId: number) => Promise<any[]>;
  createCategory: (category: any) => Promise<any>;
  clearProjectCategories: (projectId: number) => Promise<boolean>;
  updateCategory: (id: number, updates: any) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
  savePreset: (presetName: string, categories: any[]) => Promise<boolean>;
  loadPreset: (presetName: string) => Promise<any[]>;
  getPresets: () => Promise<string[]>;
  deletePreset: (presetName: string) => Promise<boolean>;

  // Clip operations
  getClips: (projectId?: number) => Promise<any[]>;
  updateClip: (id: number, updates: any) => Promise<boolean>;
  deleteClip: (id: number) => Promise<boolean>;
  getClipsByCategory: (categoryId: number) => Promise<any[]>;

  // Event listeners
  onClipProgress: (callback: (data: any) => void) => void;
  onClipCreated: (callback: (clip: any) => void) => void;
  onClipProcessId: (callback: (data: { processId: string }) => void) => void;
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

  // Update operations
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onDownloadProgress: (
    callback: (progress: {
      bytesPerSecond: number;
      percent: number;
      transferred: number;
      total: number;
    }) => void
  ) => void;
}

const electronAPI: ElectronAPI = {
  // System operations
  systemCheck: () => ipcRenderer.invoke("system-check"),
  cancelClipCreation: (processId: string) =>
    ipcRenderer.invoke("cancel-clip-creation", processId),

  // Video operations
  selectVideoFile: () => ipcRenderer.invoke("select-video-file"),
  cutVideoClip: params => ipcRenderer.invoke("cut-video-clip", params),
  openClipFolder: () => ipcRenderer.invoke("open-clip-folder"),
  playClip: clipPath => ipcRenderer.invoke("play-clip", clipPath),
  exportClipsByCategory: params =>
    ipcRenderer.invoke("export-clips-by-category", params),

  // Project operations
  createProject: project => ipcRenderer.invoke("create-project", project),
  getProject: videoPath => ipcRenderer.invoke("get-project", videoPath),
  getProjects: () => ipcRenderer.invoke("get-projects"),
  updateProjectLastOpened: projectId =>
    ipcRenderer.invoke("update-project-last-opened", projectId),
  deleteProject: id => ipcRenderer.invoke("delete-project", id),

  // Category operations
  getCategories: (projectId: number) =>
    ipcRenderer.invoke("get-categories", projectId),
  getCategoriesHierarchical: (projectId: number) =>
    ipcRenderer.invoke("get-categories-hierarchical", projectId),
  createCategory: category => ipcRenderer.invoke("create-category", category),
  clearProjectCategories: projectId =>
    ipcRenderer.invoke("clear-project-categories", projectId),
  updateCategory: (id, updates) =>
    ipcRenderer.invoke("update-category", id, updates),
  deleteCategory: id => ipcRenderer.invoke("delete-category", id),
  savePreset: (presetName, categories) =>
    ipcRenderer.invoke("save-preset", presetName, categories),
  loadPreset: presetName => ipcRenderer.invoke("load-preset", presetName),
  getPresets: () => ipcRenderer.invoke("get-presets"),
  deletePreset: presetName => ipcRenderer.invoke("delete-preset", presetName),

  // Clip operations
  getClips: projectId => ipcRenderer.invoke("get-clips", projectId),
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
  onClipProcessId: (callback: (data: { processId: string }) => void) => {
    ipcRenderer.on("clip-process-id", (_event, data) => callback(data));
  },
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  },
  resetDatabase: () => ipcRenderer.invoke("reset-database"),

  // Settings operations
  getKeyBindings: () => ipcRenderer.invoke("getKeyBindings"),
  setKeyBinding: params => ipcRenderer.invoke("setKeyBinding", params),

  // Update operations
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },
  onDownloadProgress: (
    callback: (progress: {
      bytesPerSecond: number;
      percent: number;
      transferred: number;
      total: number;
    }) => void
  ) => {
    ipcRenderer.on("download-progress", (_event, progress) =>
      callback(progress)
    );
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
