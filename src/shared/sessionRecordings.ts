const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const recordingIndex = (value: unknown, count: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const point = (value: unknown): boolean => record(value) && finite(value.x) && finite(value.y);

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
      !Array.isArray(session.categories) || !Array.isArray(session.clips)) throw invalid();

  if (session.version === 1 || session.version === 2) {
    return [typeof session.project.videoName === "string" ? session.project.videoName : ""];
  }
  if (session.version !== 3 || !Array.isArray(session.recordings) || session.recordings.length === 0 ||
      !Array.isArray(session.drawings)) throw invalid();

  const names = session.recordings.map((video: unknown) => {
    if (!record(video) || typeof video.videoName !== "string" || !video.videoName.trim()) throw invalid();
    return video.videoName;
  });
  if (!session.clips.every((clip: unknown) => record(clip) && recordingIndex(clip.recording, names.length)) ||
      !session.drawings.every((drawing: unknown) => record(drawing) && recordingIndex(drawing.recording, names.length) &&
        typeof drawing.timestamp === "number" && Number.isFinite(drawing.timestamp) && drawing.timestamp >= 0 &&
        validDrawing(drawing.data))) throw invalid();
  return names;
};
