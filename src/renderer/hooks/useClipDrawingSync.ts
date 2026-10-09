import { useEffect, useRef, useState } from "react";
import { Annotation, Clip, ClipDrawingImage } from "../../types/global";
import { clipDrawingsKey, samePath, selectClipAnnotations } from "../utils/clipDrawingSync";

interface Options {
  videoPath: string | null;
  clips: Clip[];
  annotations: Annotation[];
  // False until `annotations` belong to videoPath and the video's size is known.
  ready: boolean;
  defaultSeconds: number;
  renderDrawings: (shown: Annotation[]) => ClipDrawingImage[];
  onUpdated: (count: number) => void;
}

// Re-cuts, one at a time, every clip whose file was made with different saved
// drawings than the ones it has now. Each clip/key pair is tried once per
// session, so a clip whose source video is gone isn't retried in a loop.
export const useClipDrawingSync = ({
  videoPath,
  clips,
  annotations,
  ready,
  defaultSeconds,
  renderDrawings,
  onUpdated,
}: Options) => {
  const attempted = useRef(new Map<number, string>());
  const running = useRef(false);
  const currentVideo = useRef(videoPath);
  currentVideo.current = videoPath;
  const [finishedRuns, setFinishedRuns] = useState(0);

  useEffect(() => {
    if (!ready || !videoPath || running.current) return;
    const stale = clips.flatMap(clip => {
      if (!samePath(clip.video_path, videoPath)) return [];
      const shown = selectClipAnnotations(annotations, clip.start_time, clip.end_time, defaultSeconds);
      const key = clipDrawingsKey(shown, defaultSeconds);
      if (key === (clip.drawings_key ?? "") || attempted.current.get(clip.id) === key) return [];
      return [{ clip, shown, key }];
    });
    if (stale.length === 0) return;

    running.current = true;
    (async () => {
      let updated = 0;
      for (const { clip, shown, key } of stale) {
        // The images are sized to the open video, so stop if it changed.
        if (currentVideo.current !== videoPath) break;
        attempted.current.set(clip.id, key);
        try {
          await window.electronAPI.rerenderClipDrawings({
            clipId: clip.id,
            drawings: renderDrawings(shown),
            drawingsKey: key,
          });
          updated++;
        } catch (error) {
          console.error(`Could not update drawings in clip ${clip.id}:`, error);
        }
      }
      running.current = false;
      if (updated > 0) onUpdated(updated);
      // Drawings saved during the run are picked up on the next pass.
      setFinishedRuns(n => n + 1);
    })();
  }, [ready, videoPath, clips, annotations, defaultSeconds, renderDrawings, onUpdated, finishedRuns]);
};
