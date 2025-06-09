export interface Category {
    id?: number;
    name: string;
    color: string;
    description?: string;
    created_at?: string;
}
export interface Clip {
    id?: number;
    video_path: string;
    output_path: string;
    start_time: number;
    end_time: number;
    duration: number;
    title: string;
    categories: string;
    notes?: string;
    created_at?: string;
}
export declare const setupDatabase: () => void;
export declare const getCategories: () => Category[];
export declare const createCategory: (category: Omit<Category, "id" | "created_at">) => Category;
export declare const updateCategory: (id: number, updates: Partial<Category>) => void;
export declare const deleteCategory: (id: number) => void;
export declare const getClips: (videoPath?: string) => Clip[];
export declare const createClip: (clip: Omit<Clip, "id" | "created_at">) => Clip;
export declare const updateClip: (id: number, updates: Partial<Clip>) => void;
export declare const deleteClip: (id: number) => void;
export declare const getClipsByCategory: (categoryId: number) => Clip[];
