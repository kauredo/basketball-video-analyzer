export interface Tag {
    id?: number;
    video_path: string;
    timestamp: number;
    tag_type: string;
    description?: string;
    player?: string;
    created_at?: string;
}
export interface Clip {
    id?: number;
    video_path: string;
    start_time: number;
    end_time: number;
    title: string;
    tags?: string;
    created_at?: string;
}
export declare const setupDatabase: () => void;
export declare const saveTag: (tag: Omit<Tag, "id" | "created_at">) => Tag;
export declare const deleteTag: (tagId: number) => void;
export declare const loadTags: (videoPath: string) => Tag[];
export declare const createClip: (clip: Omit<Clip, "id" | "created_at">) => Clip;
export declare const loadClips: (videoPath: string) => Clip[];
export declare const getTagsByTimeRange: (videoPath: string, startTime: number, endTime: number) => Tag[];
