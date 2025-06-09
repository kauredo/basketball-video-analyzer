import React from "react";
interface VideoPlayerProps {
    videoPath: string | null;
    onTimeUpdate: (currentTime: number) => void;
    onDurationChange: (duration: number) => void;
    markInTime: number | null;
    markOutTime: number | null;
    onMarkIn: () => void;
    onMarkOut: () => void;
    onClearMarks: () => void;
}
export declare const VideoPlayer: React.FC<VideoPlayerProps>;
export {};
