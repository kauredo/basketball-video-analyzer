import React from "react";
interface ClipCreatorProps {
    videoPath: string | null;
    markInTime: number | null;
    markOutTime: number | null;
    onClipCreated: () => void;
    onClearMarks: () => void;
}
export declare const ClipCreator: React.FC<ClipCreatorProps>;
export {};
