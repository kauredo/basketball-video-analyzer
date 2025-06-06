import React from "react";
interface TaggingPanelProps {
    currentTime: number;
    onAddTag: (tagType: string, description?: string, player?: string) => void;
    isVideoLoaded: boolean;
}
export declare const TaggingPanel: React.FC<TaggingPanelProps>;
export {};
