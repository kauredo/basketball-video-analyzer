import React from "react";
interface Tag {
    id: number;
    timestamp: number;
    tag_type: string;
    description?: string;
    player?: string;
    created_at?: string;
}
interface TimelineProps {
    tags: Tag[];
    duration: number;
    currentTime: number;
    onTagClick: (timestamp: number) => void;
    onDeleteTag: (tagId: number) => void;
    onCreateClip: (startTime: number, endTime: number) => void;
}
export declare const Timeline: React.FC<TimelineProps>;
export {};
