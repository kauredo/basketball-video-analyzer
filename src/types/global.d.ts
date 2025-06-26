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
  setKeyBinding: (
    key: "markInKey" | "markOutKey",
    value: string
  ) => Promise<void>;
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
