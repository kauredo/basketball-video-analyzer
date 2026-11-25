export const MAX_SESSION_RECORDINGS = 100;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const recordingIndex = (value: unknown, count: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const point = (value: unknown): boolean => record(value) && finite(value.x) && finite(value.y);

const text = (value: unknown): boolean => typeof value === "string";
const optional = (value: unknown, check: (value: unknown) => boolean): boolean =>
  value === undefined || value === null || check(value);
const texts = (value: unknown): boolean => Array.isArray(value) && value.every(text);

const validClip = (clip: unknown): boolean =>
  record(clip) && text(clip.title) && finite(clip.startTime) && finite(clip.endTime) &&
  clip.startTime >= 0 && clip.endTime > clip.startTime && finite(clip.duration) && clip.duration >= 0 &&
  texts(clip.categories) && optional(clip.players, texts) &&
  optional(clip.quarter, text) && optional(clip.notes, text);

const validCategory = (category: unknown): boolean =>
  record(category) && text(category.name) && text(category.color) &&
  optional(category.parentName, text) && optional(category.description, text);

const validPlayer = (player: unknown): boolean =>
  record(player) && text(player.name) && optional(player.number, value => text(value) || finite(value));

const validDrawing = (data: unknown): boolean => {
  if (typeof data !== "string") return false;
  try {
    const shapes: unknown = JSON.parse(data);
    return Array.isArray(shapes) && shapes.every((shape: unknown) => {
      if (!record(shape) || typeof shape.id !== "string" || typeof shape.color !== "string" ||
          !finite(shape.widthFrac) || shape.widthFrac <= 0) return false;
      switch (shape.tool) {
        case "pen":
          return Array.isArray(shape.points) && shape.points.every(point);
        case "text":
          return typeof shape.text === "string" && point(shape.at) &&
            (shape.fontFrac === undefined || (finite(shape.fontFrac) && shape.fontFrac > 0));
        case "line":
        case "arrow":
        case "rect":
        case "ellipse":
          return point(shape.from) && point(shape.to);
        default:
          return false;
      }
    });
  } catch {
    return false;
  }
};

export const sessionRecordings = (session: unknown): string[] => {
  const invalid = () => new Error("INVALID_SESSION_FILE");
  if (!record(session) || !record(session.project) || typeof session.project.name !== "string" ||
      !optional(session.project.description, text) ||
      !Array.isArray(session.categories) || !session.categories.every(validCategory) ||
      !Array.isArray(session.clips) || !session.clips.every(validClip) ||
      !optional(session.players, value => Array.isArray(value) && value.every(validPlayer))) throw invalid();

  if (session.version === 1 || session.version === 2) {
    return [typeof session.project.videoName === "string" ? session.project.videoName : ""];
  }
  if (session.version !== 3 || !Array.isArray(session.recordings) || session.recordings.length === 0 ||
      session.recordings.length > MAX_SESSION_RECORDINGS ||
      !Array.isArray(session.drawings)) throw invalid();

  const names = session.recordings.map((video: unknown) => {
    if (!record(video) || typeof video.videoName !== "string" || !video.videoName.trim()) throw invalid();
    return video.videoName;
  });
  if (!session.clips.every((clip: unknown) => record(clip) && recordingIndex(clip.recording, names.length)) ||
      !session.drawings.every((drawing: unknown) => record(drawing) && recordingIndex(drawing.recording, names.length) &&
        finite(drawing.timestamp) && drawing.timestamp >= 0 &&
        validDrawing(drawing.data))) throw invalid();
  return names;
};

/** Index of the recording a project clip belongs to, for a session export. */
export const clipRecording = (
  recordingPaths: string[], clipPath: string, isSamePath: (a: string, b: string) => boolean,
): number => {
  const index = recordingPaths.findIndex(videoPath => isSamePath(videoPath, clipPath));
  if (index < 0) throw new Error("INVALID_SESSION_FILE");
  return index;
};

/** The picked video file an imported clip belongs to. Sessions before v3 have one video. */
export const importedClipPath = (version: unknown, paths: string[], recording: unknown): string =>
  paths[version === 3 ? recording as number : 0];
