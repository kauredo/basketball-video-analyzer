import { useEffect, useRef, useState } from "react";
import { Annotation, Clip, ClipDrawingImage } from "../../types/global";
import { isSamePath, savedDrawingsKey, selectSavedDrawings } from "../../shared/clipDrawings";

// Lets a run of edits (stepping through replay durations, say) settle into
// one pass instead of one re-cut per step.
const SETTLE_MS = 1500;

interface Options {
  videoPath: string | null;
  clips: Clip[];
  annotations: Annotation[];
  // False until `annotations` and the video's size both belong to videoPath.
  ready: boolean;
  defaultSeconds: number;
  renderDrawing: (annotation: Annotation) => ClipDrawingImage | null;
  onFinished: (updated: number, failed: number) => void;
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
  renderDrawing,
  onFinished,
}: Options) => {
  const attempted = useRef(new Map<number, string>());
  const running = useRef(false);
  const currentVideo = useRef(videoPath);
  currentVideo.current = videoPath;
  const [finishedRuns, setFinishedRuns] = useState(0);

  useEffect(() => {
    if (!ready || !videoPath || running.current) return;
    const stale = clips.flatMap(clip => {
      if (!isSamePath(clip.video_path, videoPath)) return [];
      const shown = selectSavedDrawings(annotations, clip.start_time, clip.end_time, defaultSeconds);
      const key = savedDrawingsKey(shown, defaultSeconds);
      if (key === (clip.drawings_key ?? "") || attempted.current.get(clip.id) === key) return [];
      return [{ clip, shown, key }];
    });
    if (stale.length === 0) return;

    const timer = window.setTimeout(async () => {
      running.current = true;
      const images = new Map<number, ClipDrawingImage | null>();
      const imageFor = (a: Annotation) => {
        if (!images.has(a.id)) images.set(a.id, renderDrawing(a));
        return images.get(a.id) ?? null;
      };
      let updated = 0;
      let failed = 0;
      for (const { clip, shown, key } of stale) {
        // The images are sized to the open video, so stop if it changed.
        if (currentVideo.current !== videoPath) break;
        const drawings = shown.map(imageFor);
        // A drawing that didn't render would leave the file short of its key.
        if (drawings.some(d => d === null)) continue;
        attempted.current.set(clip.id, key);
        try {
          await window.electronAPI.rerenderClipDrawings({
            clipId: clip.id,
            drawings: drawings as ClipDrawingImage[],
            drawingsKey: key,
          });
          updated++;
        } catch (error) {
          failed++;
          console.error(`Could not update drawings in clip ${clip.id}:`, error);
        }
      }
      running.current = false;
      if (updated > 0 || failed > 0) onFinished(updated, failed);
      // Drawings saved during the run are picked up on the next pass.
      setFinishedRuns(n => n + 1);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, videoPath, clips, annotations, defaultSeconds, renderDrawing, onFinished, finishedRuns]);
};
