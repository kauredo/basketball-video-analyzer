// Builds the ffmpeg filter graph that burns saved drawings into a clip at
// the moment they appear, freezing the picture for drawings set to pause.

export interface ClipDrawing {
  start: number; // seconds from the clip's start
  seconds: number; // how long it stays up
  pause: boolean;
}

export interface DrawingGraph {
  filters: string[];
  videoOut: string;
  audioOut: string | null; // null: map the source audio as it is
  addedSeconds: number; // how much longer the freezes make the clip
}

// Freezing repeats frames, which needs a known frame rate. Clips with
// drawings are re-timed to this rate.
export const DRAWING_FPS = 30;

const frame = (seconds: number) => Math.round(seconds * DRAWING_FPS);
const fmt = (n: number) => Number(n.toFixed(3)).toString();

// Drawings arrive as ffmpeg inputs firstInput, firstInput + 1, ... in the
// same order as `drawings`.
export const buildDrawingGraph = (
  duration: number,
  drawings: ClipDrawing[],
  firstInput: number,
  hasAudio: boolean
): DrawingGraph => {
  // Pauses at the same frame become one freeze, held for the longest of them,
  // which is what playback does.
  const holds = new Map<number, number>();
  for (const d of drawings) {
    if (!d.pause) continue;
    const at = frame(d.start);
    holds.set(at, Math.max(holds.get(at) ?? 0, d.seconds));
  }
  const freezes = [...holds.entries()]
    .map(([at, seconds]) => ({ at, frames: frame(seconds) }))
    .filter(f => f.frames > 0)
    .sort((a, b) => a.at - b.at);

  // Output time of a source moment: the freezes that come before it add on.
  const frozenBefore = (atFrame: number) =>
    freezes
      .filter(f => f.at < atFrame)
      .reduce((sum, f) => sum + f.frames, 0);
  const outTime = (seconds: number) =>
    (frame(seconds) + frozenBefore(frame(seconds))) / DRAWING_FPS;

  const filters: string[] = [`[0:v]fps=${DRAWING_FPS}[v0]`];
  let label = "v0";
  let inserted = 0;
  freezes.forEach((f, i) => {
    // loop's start counts frames of its own input, which already carries the
    // frames earlier freezes added.
    filters.push(
      `[${label}]loop=loop=${f.frames}:size=1:start=${f.at + inserted}[f${i}]`
    );
    inserted += f.frames;
    label = `f${i}`;
  });
  filters.push(`[${label}]setpts=N/(${DRAWING_FPS}*TB)[base]`);
  label = "base";

  drawings.forEach((d, i) => {
    const from = outTime(d.start);
    const to = d.pause
      ? from + (holds.get(frame(d.start)) ?? 0)
      : outTime(d.start + d.seconds);
    filters.push(
      `[${label}][${firstInput + i}:v]overlay=0:0:enable='gte(t,${fmt(from)})*lt(t,${fmt(to)})'[d${i}]`
    );
    label = `d${i}`;
  });

  const addedSeconds = inserted / DRAWING_FPS;
  if (!hasAudio || freezes.length === 0) {
    return { filters, videoOut: label, audioOut: null, addedSeconds };
  }

  // Splice silence into the audio wherever the picture freezes.
  const cuts = freezes.map(f => f.at / DRAWING_FPS);
  const bounds = [0, ...cuts, duration];
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
  return { filters, videoOut: label, audioOut: "aout", addedSeconds };
};
