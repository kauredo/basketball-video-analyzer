// What `ffmpeg -i` says about a file, and whether the app's player
// (Chromium in Electron 28) can open it as it is.

export interface ProbedVideo {
  /** ffmpeg's demuxer names, e.g. "mov,mp4,m4a,3gp,3g2,mj2" or "mpegts". */
  container: string;
  durationSeconds: number | null;
  /** Codec of the first video stream, cover art excluded. */
  video: string | null;
  /** Codec of the first audio stream. */
  audio: string | null;
}

export type PlayablePlan =
  | { kind: "plays" }
  | { kind: "convert"; video: "copy" | "encode"; audio: "copy" | "encode" | "none" }
  | { kind: "no-video" };

const PLAYER_CONTAINERS = ["mov", "matroska"];
const PLAYER_VIDEO = ["h264", "hevc", "vp8", "vp9", "av1"];
const PLAYER_AUDIO = ["aac", "mp3", "opus", "vorbis", "flac"];
// Codecs the copy keeps as they are. The copy is always an MP4.
const MP4_VIDEO = ["h264", "hevc", "vp9", "av1"];
const MP4_AUDIO = ["aac", "mp3", "opus", "flac"];

export const parseProbe = (stderr: string): ProbedVideo => {
  const input = /^Input #0, ([^ ]+), from /m.exec(stderr);
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const streams = stderr.split("\n").filter(line => /^\s*Stream #0:/.test(line));
  const codec = (type: string) => {
    const line = streams.find(s => s.includes(`: ${type}: `) && !s.includes("(attached pic)"));
    return line ? new RegExp(`: ${type}: ([\\w-]+)`).exec(line)?.[1] ?? null : null;
  };
  return {
    container: input?.[1].replace(/,$/, "") ?? "",
    durationSeconds: duration
      ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
      : null,
    video: codec("Video"),
    audio: codec("Audio"),
  };
};

const playerAudio = (codec: string) => PLAYER_AUDIO.includes(codec) || codec.startsWith("pcm_");

/**
 * How to make a file the player opens. `force` is for a file the probe calls
 * playable that the player still refused, such as HEVC on a PC without a
 * hardware decoder, so its video is re-encoded.
 */
export const playablePlan = (probe: ProbedVideo, force = false): PlayablePlan => {
  if (!probe.video) return { kind: "no-video" };
  const container = probe.container.split(",")[0];
  const plays = PLAYER_CONTAINERS.includes(container) && PLAYER_VIDEO.includes(probe.video) &&
    (probe.audio === null || playerAudio(probe.audio));
  if (plays && !force) return { kind: "plays" };
  return {
    kind: "convert",
    video: !force && MP4_VIDEO.includes(probe.video) ? "copy" : "encode",
    audio: probe.audio === null ? "none" : MP4_AUDIO.includes(probe.audio) ? "copy" : "encode",
  };
};

/** ffmpeg output options for a convert plan, writing an MP4. */
export const convertArgs = (
  plan: Extract<PlayablePlan, { kind: "convert" }>, videoCodec: string,
): string[] => [
  // V, not v: cover art is a video stream too, and parseProbe skips it.
  "-map", "0:V:0", "-map", "0:a:0?", "-sn", "-dn",
  ...(plan.video === "copy"
    ? ["-c:v", "copy", ...(videoCodec === "hevc" ? ["-tag:v", "hvc1"] : [])]
    // Game film doesn't need more than 1080p, and a 4K encode takes hours longer.
    : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-vf", "scale=-2:'min(1080,ih)'"]),
  ...(plan.audio === "copy" ? ["-c:a", "copy"] : plan.audio === "encode" ? ["-c:a", "aac", "-b:a", "160k"] : []),
  // Camera files (.mts) start at a second or so. The copy starts at zero, so
  // the player's time and ffmpeg's cut times agree.
  "-avoid_negative_ts", "make_zero",
  "-f", "mp4",
];

/** Seconds ffmpeg has written, from a "time=" progress line. */
export const progressSeconds = (line: string): number | null => {
  const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
};
