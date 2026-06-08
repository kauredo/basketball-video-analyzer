export interface Category {
  id?: number;
  name: string;
  color: string;
  description?: string;
  created_at?: string;
  parent_id?: number;
  children?: Category[];
}

export interface Player {
  id: number;
  name: string;
  number?: string | null;
  project_id?: number;
  created_at?: string;
}

export interface Clip {
  id: number;
  video_path: string;
  output_path: string;
  thumbnail_path?: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  categories: string; // JSON array of category IDs
  players?: string; // JSON array of player IDs
  quarter?: string | null;
  notes?: string;
  created_at: string;
}

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
    processId: string,
  ) => Promise<{ success: boolean; reason?: string }>;

  // Video operations
  selectVideoFile: () => Promise<string | null>;
  cutVideoClip: (params: {
    inputPath: string;
    startTime: number;
    endTime: number;
    title: string;
    categories: number[];
    players?: number[];
    quarter?: string | null;
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

  // Category operations
  getCategories: () => Promise<Category[]>;
  getCategoriesHierarchical: () => Promise<Category[]>;
  createCategory: (
    category: Omit<Category, "id" | "created_at">,
  ) => Promise<Category>;
  updateCategory: (id: number, updates: Partial<Category>) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
  savePreset: (presetName: string, categories: Category[]) => Promise<boolean>;
  loadPreset: (presetName: string) => Promise<Category[]>;
  getPresets: () => Promise<string[]>;

  // Player operations
  getPlayers: (projectId: number) => Promise<Player[]>;
  createPlayer: (player: Omit<Player, "id" | "created_at">) => Promise<Player>;
  updatePlayer: (id: number, updates: Partial<Player>) => Promise<boolean>;
  deletePlayer: (id: number) => Promise<boolean>;

  // Export clips data
  exportClipsData: (projectId: number) => Promise<{ filePath: string; count: number } | null>;

  // Session operations
  saveSession: (projectId: number) => Promise<{ filePath: string; success: boolean } | null>;
  loadSession: () => Promise<{ success: boolean; project: any } | null>;

  // YouTube operations
  downloadYoutubeVideo: (url: string) => Promise<{ filePath: string; fileName: string; success: boolean }>;
  onYoutubeDownloadProgress: (callback: (data: { percent: number; status: string }) => void) => void;

  // Clip operations
  getClips: (videoPath?: string) => Promise<any[]>;
  updateClip: (id: number, updates: any) => Promise<boolean>;
  deleteClip: (id: number) => Promise<boolean>;
  getClipsByCategory: (categoryId: number) => Promise<any[]>;

  // Event listeners
  onClipProgress: (callback: (data: any) => void) => void;
  onClipCreated: (callback: (clip: any) => void) => void;
  onClipProcessId: (callback: (data: { processId: string }) => void) => void;
  onKeyBindingsChanged: (
    callback: (bindings: { markInKey: string; markOutKey: string }) => void,
  ) => void;
  removeAllListeners: (channel: string) => void;
  resetDatabase: () => Promise<boolean>;

  // Settings operations
  getKeyBindings: () => Promise<{ markInKey: string; markOutKey: string }>;
  setKeyBinding: (
    key: "markInKey" | "markOutKey",
    value: string,
  ) => Promise<void>;

  // Feedback
  onOpenFeedback: (callback: () => void) => void;

  // Update operations
  onUpdateAvailable: (callback: (info: { version: string }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  onUpdateError: (callback: (err: { message: string }) => void) => void;
  onDownloadProgress: (
    callback: (progress: {
      bytesPerSecond: number;
      percent: number;
      transferred: number;
      total: number;
    }) => void,
  ) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// JSON module declarations for i18n
declare module "*.json" {
  const value: any;
  export default value;
}
