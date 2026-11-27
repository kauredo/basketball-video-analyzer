import type { Annotation, Category, Clip, Player, Project } from "./database";
import type { ProjectVideo } from "./projectVideos";

export const SESSION_VERSION = 4;
export const MAX_SESSION_RECORDINGS = 100;

const invalid = () => new Error("INVALID_SESSION_FILE");

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

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUid = (value: unknown): value is string => typeof value === "string" && UID.test(value);

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

/** Checks the shape every version shares and returns the recording names to ask for. */
export const sessionRecordings = (session: unknown): string[] => {
  if (!record(session) || !record(session.project) || typeof session.project.name !== "string" ||
      !optional(session.project.description, text) ||
      !Array.isArray(session.categories) || !session.categories.every(validCategory) ||
      !Array.isArray(session.clips) || !session.clips.every(validClip) ||
      !optional(session.players, value => Array.isArray(value) && value.every(validPlayer))) throw invalid();

  if (session.version === 1 || session.version === 2) {
    return [typeof session.project.videoName === "string" ? session.project.videoName : ""];
  }
  if ((session.version !== 3 && session.version !== 4) || !Array.isArray(session.recordings) ||
      session.recordings.length === 0 || session.recordings.length > MAX_SESSION_RECORDINGS ||
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
  if (index < 0) throw invalid();
  return index;
};

export interface SessionSource {
  project: Project;
  recordings: Array<ProjectVideo & { drawings: Annotation[] }>;
  /** Flat, as getCategories returns them. Only top-level categories and their children are written. */
  categories: Category[];
  players: Player[];
  clips: Clip[];
}

const parseIds = (json: string | undefined): unknown[] => {
  try {
    const ids: unknown = JSON.parse(json || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

export const buildSession = (
  source: SessionSource,
  isSamePath: (a: string, b: string) => boolean,
  exportedAt = new Date().toISOString(),
) => {
  const parents = source.categories.filter(cat => !cat.parent_id);
  const categories = parents.flatMap(parent => [
    { category: parent, parent: null as Category | null },
    ...source.categories
      .filter(cat => cat.parent_id === parent.id)
      .map(category => ({ category, parent })),
  ]);
  const categoryById = new Map(categories.map(({ category }) => [category.id, category]));
  const playerById = new Map(source.players.map(player => [player.id, player]));
  const recordingPaths = source.recordings.map(video => video.video_path);

  return {
    version: SESSION_VERSION,
    exportedAt,
    project: {
      uid: source.project.uid,
      name: source.project.name,
      videoName: source.project.video_name,
      description: source.project.description || "",
    },
    recordings: source.recordings.map(video => ({ uid: video.uid, videoName: video.video_name })),
    drawings: source.recordings.flatMap((video, recording) =>
      video.drawings.map(annotation => ({
        uid: annotation.uid,
        recording,
        recordingUid: video.uid,
        timestamp: annotation.timestamp,
        data: annotation.data,
        displaySeconds: annotation.display_seconds,
        pausePlayback: annotation.pause_playback === true,
      }))),
    players: source.players.map(player => ({
      uid: player.uid,
      name: player.name,
      number: player.number || "",
    })),
    categories: categories.map(({ category, parent }) => ({
      uid: category.uid,
      name: category.name,
      color: category.color,
      description: category.description || "",
      parentName: parent?.name ?? null,
      parentUid: parent?.uid ?? null,
    })),
    clips: source.clips.map(clip => {
      const clipCategories = parseIds(clip.categories)
        .map(id => categoryById.get(id as number))
        .filter((cat): cat is Category => cat !== undefined);
      const clipPlayers = parseIds(clip.players)
        .map(id => playerById.get(id as number))
        .filter((player): player is Player => player !== undefined);
      const recording = clipRecording(recordingPaths, clip.video_path, isSamePath);
      return {
        uid: clip.uid,
        recording,
        recordingUid: source.recordings[recording].uid,
        title: clip.title,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration,
        categories: clipCategories.map(cat => cat.name),
        categoryUids: clipCategories.map(cat => cat.uid),
        players: clipPlayers.map(player => player.name),
        playerUids: clipPlayers.map(player => player.uid),
        quarter: clip.quarter || null,
        notes: clip.notes || "",
        courtX: clip.court_x ?? null,
        courtY: clip.court_y ?? null,
        status: clip.status ?? null,
      };
    }),
  };
};

/**
 * What load-session writes. `key` is what clips and child categories use to
 * point at a row: the name before v4 (as those files did), the uid from v4 on.
 * `uid` is null when the file had none.
 */
export interface ParsedSession {
  version: number;
  project: { uid: string | null; name: string; description: string };
  recordings: Array<{ uid: string | null; videoName: string }>;
  categories: Array<{
    uid: string | null; key: string; parentKey: string | null;
    name: string; color: string; description: string;
  }>;
  players: Array<{ uid: string | null; key: string; name: string; number: string | null }>;
  clips: Array<{
    uid: string | null; recording: number; categoryKeys: string[]; playerKeys: string[];
    title: string; startTime: number; endTime: number; duration: number;
    quarter: string | null; notes: string; courtX: number | null; courtY: number | null;
    status: "keep" | "cut" | "review" | null;
  }>;
  drawings: Array<{
    uid: string | null; recording: number; timestamp: number; data: string;
    displaySeconds: number | null; pausePlayback: boolean;
  }>;
}

type Row = Record<string, unknown>;

const uniqueUids = (rows: unknown[]): string[] => {
  const uids = rows.map(row => (record(row) ? row.uid : undefined));
  if (!uids.every(isUid) || new Set(uids).size !== uids.length) throw invalid();
  return uids;
};

/** A v4 file links by uid, so every link has to land on a row in the file. */
const checkLinks = (session: Row): void => {
  if (!isUid((session.project as Row).uid) || !Array.isArray(session.players)) throw invalid();
  const recordings = new Set(uniqueUids(session.recordings as unknown[]));
  const players = new Set(uniqueUids(session.players));
  uniqueUids(session.clips as unknown[]);
  uniqueUids(session.drawings as unknown[]);

  const categories = new Set<string>();
  for (const category of session.categories as Row[]) {
    if (!isUid(category.uid) || categories.has(category.uid)) throw invalid();
    if (!optional(category.parentUid, parent => isUid(parent) && categories.has(parent))) throw invalid();
    categories.add(category.uid);
  }
  for (const clip of session.clips as Row[]) {
    if (!isUid(clip.recordingUid) || !recordings.has(clip.recordingUid) ||
        !texts(clip.categoryUids) || !(clip.categoryUids as string[]).every(uid => categories.has(uid)) ||
        !texts(clip.playerUids) || !(clip.playerUids as string[]).every(uid => players.has(uid))) throw invalid();
  }
  for (const drawing of session.drawings as Row[]) {
    if (!isUid(drawing.recordingUid) || !recordings.has(drawing.recordingUid)) throw invalid();
  }
};

const CLIP_STATUSES = ["keep", "cut", "review"];

export const parseSession = (json: string): ParsedSession => {
  let session: unknown;
  try {
    session = JSON.parse(json);
  } catch {
    throw invalid();
  }
  const names = sessionRecordings(session);
  const data = session as Row;
  const project = data.project as Row;
  const version = data.version as number;
  const v4 = version === 4;
  if (v4) checkLinks(data);

  const recordingUids = v4 ? (data.recordings as Row[]).map(video => video.uid as string) : [];
  const uidOf = (row: Row) => (v4 ? row.uid as string : null);

  return {
    version,
    project: { uid: uidOf(project), name: project.name as string, description: (project.description as string) || "" },
    recordings: names.map((videoName, index) => ({
      uid: v4 ? recordingUids[index] : null,
      videoName,
    })),
    categories: (data.categories as Row[]).map(cat => ({
      uid: uidOf(cat),
      key: v4 ? cat.uid as string : cat.name as string,
      parentKey: ((v4 ? cat.parentUid : cat.parentName) as string | null | undefined) || null,
      name: cat.name as string,
      color: cat.color as string,
      description: (cat.description as string) || "",
    })),
    players: (Array.isArray(data.players) ? data.players as Row[] : []).map(player => ({
      uid: uidOf(player),
      key: v4 ? player.uid as string : player.name as string,
      name: player.name as string,
      number: player.number ? String(player.number) : null,
    })),
    clips: (data.clips as Row[]).map(clip => ({
      uid: uidOf(clip),
      recording: v4 ? recordingUids.indexOf(clip.recordingUid as string)
        : version === 3 ? clip.recording as number : 0,
      categoryKeys: (v4 ? clip.categoryUids : clip.categories) as string[],
      playerKeys: v4 ? clip.playerUids as string[] : Array.isArray(clip.players) ? clip.players as string[] : [],
      title: clip.title as string,
      startTime: clip.startTime as number,
      endTime: clip.endTime as number,
      duration: clip.duration as number,
      quarter: (clip.quarter as string | null | undefined) ?? null,
      notes: (clip.notes as string) || "",
      courtX: finite(clip.courtX) ? clip.courtX : null,
      courtY: finite(clip.courtY) ? clip.courtY : null,
      status: CLIP_STATUSES.includes(clip.status as string) ? clip.status as "keep" | "cut" | "review" : null,
    })),
    drawings: (version >= 3 ? data.drawings as Row[] : []).map(drawing => ({
      uid: uidOf(drawing),
      recording: v4 ? recordingUids.indexOf(drawing.recordingUid as string) : drawing.recording as number,
      timestamp: drawing.timestamp as number,
      data: drawing.data as string,
      displaySeconds: finite(drawing.displaySeconds) ? drawing.displaySeconds : null,
      pausePlayback: drawing.pausePlayback === true,
    })),
  };
};

/** The same session with every uid dropped, so the import becomes a new copy. */
export const withoutUids = (session: ParsedSession): ParsedSession => ({
  ...session,
  project: { ...session.project, uid: null },
  recordings: session.recordings.map(row => ({ ...row, uid: null })),
  categories: session.categories.map(row => ({ ...row, uid: null })),
  players: session.players.map(row => ({ ...row, uid: null })),
  clips: session.clips.map(row => ({ ...row, uid: null })),
  drawings: session.drawings.map(row => ({ ...row, uid: null })),
});
