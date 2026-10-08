// Builds the ffmpeg filter graph that burns saved drawings into a clip at
// the moment they appear, freezing the picture for drawings set to pause.

export interface ClipDrawing {
  start: number; // seconds from the clip's start; negative if it began earlier
  seconds: number; // how long it stays up
  pause: boolean;
}

export interface DrawingGraph {
  filters: string[];
  videoOut: string;
  // What to pass to -map for audio: the spliced track, the source as it is,
  // or null to drop it.
  audioMap: string | null;
  addedSeconds: number; // how much longer the freezes make the clip
}

// Freezing repeats frames, which needs a known frame rate. Clips with a
// freeze are re-timed to this rate.
export const DRAWING_FPS = 30;
export const MAX_CLIP_DRAWINGS = 20;
const MAX_DRAWING_SECONDS = 60;

const frame = (seconds: number) => Math.round(seconds * DRAWING_FPS);
const fmt = (n: number) => Number(n.toFixed(3)).toString();

// Which saved drawings show up in a clip, matching how they replay when the
// clip's range is played: a drawing already on screen at mark-in carries on
// into it, but a pausing one only counts if playback reaches it.
export const selectClipDrawings = <T extends { timestamp: number; seconds: number; pause: boolean }>(
  clipStart: number,
  duration: number,
  drawings: T[]
): (T & ClipDrawing)[] =>
  drawings
    .map(d => ({ ...d, start: d.timestamp - clipStart, pause: d.pause === true }))
    // The negated checks also drop NaN from a malformed renderer payload.
    .filter(d => d.seconds > 0 && d.seconds <= MAX_DRAWING_SECONDS)
    .filter(d =>
      d.pause
        ? d.start >= 0 && d.start < duration
        : d.start < duration && d.start + d.seconds > 0
    )
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CLIP_DRAWINGS);

// Drawings arrive as ffmpeg inputs firstInput, firstInput + 1, ... in the
// same order as `drawings`. `extraOverlayInput`, if given, is laid over the
// whole clip last.
export const buildDrawingGraph = (
  duration: number,
  drawings: ClipDrawing[],
  firstInput: number,
  hasAudio: boolean,
  extraOverlayInput?: number
): DrawingGraph => {
  // A freeze has to land on a frame that exists, or loop adds nothing while
  // the audio still gets its silence.
  const lastFrame = Math.max(0, Math.ceil(duration * DRAWING_FPS) - 1);

  // Pauses at the same frame become one freeze, held for the longest of them,
  // which is what playback does.
  const holds = new Map<number, number>();
  for (const d of drawings) {
    if (!d.pause) continue;
    const at = Math.min(frame(d.start), lastFrame);
    holds.set(at, Math.max(holds.get(at) ?? 0, d.seconds));
  }
  const freezes = [...holds.entries()]
    .map(([at, seconds]) => ({ at, frames: frame(seconds) }))
    .filter(f => f.frames > 0)
    .sort((a, b) => a.at - b.at);

  // Output time of a source moment: the freezes that come before it add on.
  const outTime = (seconds: number) => {
    const at = frame(seconds);
    const frozen = freezes
      .filter(f => f.at < at)
      .reduce((sum, f) => sum + f.frames, 0);
    return (at + frozen) / DRAWING_FPS;
  };

  const filters: string[] = [];
  let label = "0:v";
  let inserted = 0;
  if (freezes.length > 0) {
    filters.push(`[0:v]fps=${DRAWING_FPS}[v0]`);
    label = "v0";
    freezes.forEach((f, i) => {
      // loop's start counts frames of its own input, which already carries
      // the frames earlier freezes added.
      filters.push(
        `[${label}]loop=loop=${f.frames}:size=1:start=${f.at + inserted}[f${i}]`
      );
      inserted += f.frames;
      label = `f${i}`;
    });
    filters.push(`[${label}]setpts=N/(${DRAWING_FPS}*TB)[base]`);
    label = "base";
  }

  drawings.forEach((d, i) => {
    const freezeAt = Math.min(frame(d.start), lastFrame);
    const from = d.pause
      ? outTime(freezeAt / DRAWING_FPS)
      : outTime(Math.max(0, d.start));
    const to = d.pause
      ? from + (holds.get(freezeAt) ?? 0)
      : outTime(d.start + d.seconds);
    filters.push(
      `[${label}][${firstInput + i}:v]overlay=0:0:enable='gte(t,${fmt(from)})*lt(t,${fmt(to)})'[d${i}]`
    );
    label = `d${i}`;
  });

  if (extraOverlayInput !== undefined) {
    filters.push(`[${label}][${extraOverlayInput}:v]overlay=0:0[still]`);
    label = "still";
  }

  const addedSeconds = inserted / DRAWING_FPS;
  if (freezes.length === 0) {
    return { filters, videoOut: label, audioMap: "0:a?", addedSeconds };
  }
  // With freezes, unspliced audio would drift out of sync, so drop it.
  if (!hasAudio) {
    return { filters, videoOut: label, audioMap: null, addedSeconds };
  }

  // Splice silence into the audio wherever the picture freezes.
  const bounds = [0, ...freezes.map(f => f.at / DRAWING_FPS), duration];
  const parts = bounds.length - 1;
  filters.push(
    `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=${parts}${Array.from(
      { length: parts },
      (_, i) => `[a${i}]`
    ).join("")}`
  );
  const pieces: string[] = [];
  for (let i = 0; i < parts; i++) {
    filters.push(
      `[a${i}]atrim=start=${fmt(bounds[i])}:end=${fmt(bounds[i + 1])},asetpts=PTS-STARTPTS[s${i}]`
    );
    pieces.push(`[s${i}]`);
    if (i < freezes.length) {
      filters.push(
        `aevalsrc=0:c=stereo:s=44100:d=${fmt(freezes[i].frames / DRAWING_FPS)}[z${i}]`
      );
      pieces.push(`[z${i}]`);
    }
  }
  filters.push(`${pieces.join("")}concat=n=${pieces.length}:v=0:a=1[aout]`);
  return { filters, videoOut: label, audioMap: "[aout]", addedSeconds };
};
