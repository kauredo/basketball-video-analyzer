import React from "react";
interface VideoPlayerProps {
    videoPath: string | null;
    onTimeUpdate: (currentTime: number) => void;
    onDurationChange: (duration: number) => void;
    seekToTime?: number;
    playbackRate?: number;
}
export declare const VideoPlayer: React.FC<VideoPlayerProps>;
export {};
