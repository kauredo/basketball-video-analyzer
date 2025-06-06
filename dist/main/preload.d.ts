export interface ElectronAPI {
    selectVideoFile: () => Promise<string | null>;
    saveTag: (tag: any) => Promise<any>;
    deleteTag: (tagId: number) => Promise<boolean>;
    loadTags: (videoPath: string) => Promise<any[]>;
    createClip: (clip: any) => Promise<any>;
    loadClips: (videoPath: string) => Promise<any[]>;
    exportClipsData: (data: any) => Promise<string | null>;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
