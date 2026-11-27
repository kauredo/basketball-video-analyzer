import path from "path";
import type * as Db from "./database";
import type { Annotation, Category, Clip, Player, Project } from "./database";
import type { UidTable } from "./permanentIds";
import type { ProjectVideo } from "./projectVideos";

export const SESSION_VERSION = 4;
export const MAX_SESSION_BYTES = 50 * 1024 * 1024;
export const MAX_SESSION_RECORDINGS = 100;
export const MAX_SESSION_CLIPS = 20000;
export const MAX_SESSION_DRAWINGS = 20000;
export const MAX_SESSION_CATEGORIES = 2000;
export const MAX_SESSION_PLAYERS = 2000;
/** Names, titles and video names. */
export const MAX_NAME_LENGTH = 2000;
/** Notes and descriptions. */
export const MAX_NOTES_LENGTH = 20000;

const invalid = () => new Error("INVALID_SESSION_FILE");

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const recordingIndex = (value: unknown, count: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const point = (value: unknown): boolean => record(value) && finite(value.x) && finite(value.y);

const text = (value: unknown): boolean => typeof value === "string";
const name = (value: unknown): boolean => typeof value === "string" && value.length <= MAX_NAME_LENGTH;
const longText = (value: unknown): boolean => typeof value === "string" && value.length <= MAX_NOTES_LENGTH;
const optional = (value: unknown, check: (value: unknown) => boolean): boolean =>
  value === undefined || value === null || check(value);
const texts = (value: unknown): boolean => Array.isArray(value) && value.every(text);
const list = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max;

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isUid = (value: unknown): value is string => typeof value === "string" && UID.test(value);
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const validClip = (clip: unknown): boolean =>
  record(clip) && name(clip.title) && finite(clip.startTime) && finite(clip.endTime) &&
  clip.startTime >= 0 && clip.endTime > clip.startTime && finite(clip.duration) && clip.duration >= 0 &&
  texts(clip.categories) && optional(clip.players, texts) &&
  optional(clip.quarter, text) && optional(clip.notes, longText);

const validCategory = (category: unknown): boolean =>
  record(category) && name(category.name) && typeof category.color === "string" && HEX_COLOR.test(category.color) &&
  optional(category.parentName, text) && optional(category.description, longText);

const validPlayer = (player: unknown): boolean =>
  record(player) && name(player.name) && optional(player.number, value => text(value) || finite(value));

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
  if (!record(session) || !record(session.project) || !name(session.project.name) ||
      !optional(session.project.description, longText) ||
      (typeof session.project.videoName === "string" && !name(session.project.videoName)) ||
      !list(session.categories, MAX_SESSION_CATEGORIES) || !session.categories.every(validCategory) ||
      !list(session.clips, MAX_SESSION_CLIPS) || !session.clips.every(validClip) ||
      !optional(session.players, value => list(value, MAX_SESSION_PLAYERS) && value.every(validPlayer))) throw invalid();

  if (session.version === 1 || session.version === 2) {
    return [typeof session.project.videoName === "string" ? session.project.videoName : ""];
  }
  if ((session.version !== 3 && session.version !== 4) || !Array.isArray(session.recordings) ||
      session.recordings.length === 0 || session.recordings.length > MAX_SESSION_RECORDINGS ||
      !list(session.drawings, MAX_SESSION_DRAWINGS)) throw invalid();

  const names = session.recordings.map((video: unknown) => {
    if (!record(video) || !name(video.videoName) || !(video.videoName as string).trim()) throw invalid();
    return video.videoName as string;
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

/** Later layers match rows by uid, so a row without one must never be written. */
const writtenUid = (row: { uid?: string }): string => {
  if (!row.uid) throw new Error("SESSION_ROW_WITHOUT_UID");
  return row.uid.toLowerCase();
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
      uid: writtenUid(source.project),
      name: source.project.name,
      videoName: source.project.video_name,
      description: source.project.description || "",
    },
    recordings: source.recordings.map(video => ({ uid: writtenUid(video), videoName: video.video_name })),
    drawings: source.recordings.flatMap((video, recording) =>
      video.drawings.map(annotation => ({
        uid: writtenUid(annotation),
        recording,
        recordingUid: writtenUid(video),
        timestamp: annotation.timestamp,
        data: annotation.data,
        displaySeconds: annotation.display_seconds,
        pausePlayback: annotation.pause_playback === true,
      }))),
    players: source.players.map(player => ({
      uid: writtenUid(player),
      name: player.name,
      number: player.number || "",
    })),
    categories: categories.map(({ category, parent }) => ({
      uid: writtenUid(category),
      name: category.name,
      color: category.color,
      description: category.description || "",
      parentName: parent?.name ?? null,
      parentUid: parent ? writtenUid(parent) : null,
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
        uid: writtenUid(clip),
        recording,
        recordingUid: writtenUid(source.recordings[recording]),
        title: clip.title,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration,
        categories: clipCategories.map(cat => cat.name),
        categoryUids: clipCategories.map(writtenUid),
        players: clipPlayers.map(player => player.name),
        playerUids: clipPlayers.map(writtenUid),
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
 * Every uid is null when the file had none. `recording` indexes the picked files.
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
    uid: string | null; recording: number; recordingUid: string | null;
    categoryKeys: string[]; playerKeys: string[];
    title: string; startTime: number; endTime: number; duration: number;
    quarter: string | null; notes: string; courtX: number | null; courtY: number | null;
    status: "keep" | "cut" | "review" | null;
  }>;
  drawings: Array<{
    uid: string | null; recording: number; recordingUid: string | null; timestamp: number; data: string;
    displaySeconds: number | null; pausePlayback: boolean;
  }>;
}

type Row = Record<string, unknown>;

const lower = (value: unknown): unknown => (typeof value === "string" ? value.toLowerCase() : value);
const lowerAll = (value: unknown): unknown => (Array.isArray(value) ? value.map(lower) : value);

/** Uids are matched exactly, so a v4 file's uids are lowercased before anything reads them. */
const lowercaseUids = (session: Row): void => {
  const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(record) : []);
  (session.project as Row).uid = lower((session.project as Row).uid);
  for (const row of [...rows(session.recordings), ...rows(session.players)]) row.uid = lower(row.uid);
  for (const row of rows(session.categories)) {
    row.uid = lower(row.uid);
    row.parentUid = lower(row.parentUid);
  }
  for (const row of rows(session.drawings)) {
    row.uid = lower(row.uid);
    row.recordingUid = lower(row.recordingUid);
  }
  for (const row of rows(session.clips)) {
    row.uid = lower(row.uid);
    row.recordingUid = lower(row.recordingUid);
    row.categoryUids = lowerAll(row.categoryUids);
    row.playerUids = lowerAll(row.playerUids);
  }
};

const uniqueUids = (rows: unknown[]): string[] => {
  const uids = rows.map(row => (record(row) ? row.uid : undefined));
  if (!uids.every(isUid) || new Set(uids).size !== uids.length) throw invalid();
  return uids;
};

/** A v4 file links by uid, so every link has to land on a row in the file. */
const checkLinks = (session: Row): void => {
  if (!isUid((session.project as Row).uid) || !Array.isArray(session.players)) throw invalid();
  const recordings = uniqueUids(session.recordings as unknown[]);
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
    if (recordings[clip.recording as number] !== clip.recordingUid ||
        !texts(clip.categoryUids) || !(clip.categoryUids as string[]).every(uid => categories.has(uid)) ||
        !texts(clip.playerUids) || !(clip.playerUids as string[]).every(uid => players.has(uid))) throw invalid();
  }
  for (const drawing of session.drawings as Row[]) {
    if (recordings[drawing.recording as number] !== drawing.recordingUid) throw invalid();
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
  if (v4) {
    lowercaseUids(data);
    checkLinks(data);
  }

  const uidOf = (row: Row) => (v4 ? row.uid as string : null);

  return {
    version,
    project: { uid: uidOf(project), name: project.name as string, description: (project.description as string) || "" },
    recordings: names.map((videoName, index) => ({
      uid: v4 ? (data.recordings as Row[])[index].uid as string : null,
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
      recording: version >= 3 ? clip.recording as number : 0,
      recordingUid: v4 ? clip.recordingUid as string : null,
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
      recording: drawing.recording as number,
      recordingUid: v4 ? drawing.recordingUid as string : null,
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
  clips: session.clips.map(row => ({ ...row, uid: null, recordingUid: null })),
  drawings: session.drawings.map(row => ({ ...row, uid: null, recordingUid: null })),
});

/**
 * Keeps the file's uids only when none of them is already in this database;
 * otherwise the import becomes a new copy, so the unique indexes never fail.
 */
export const prepareImport = (
  session: ParsedSession,
  uidExists: (table: UidTable, uids: string[]) => boolean,
): ParsedSession => {
  const groups: Array<[UidTable, Array<{ uid: string | null }>]> = [
    ["projects", [session.project]],
    ["project_videos", session.recordings],
    ["categories", session.categories],
    ["players", session.players],
    ["clips", session.clips],
    ["annotations", session.drawings],
  ];
  const taken = groups.some(([table, rows]) => {
    const uids = rows.map(row => row.uid).filter((uid): uid is string => uid !== null);
    return uids.length > 0 && uidExists(table, uids);
  });
  return taken ? withoutUids(session) : session;
};

export type SessionStore = Pick<typeof Db,
  "createProject" | "addProjectVideo" | "createCategory" | "createPlayer" | "createClip" | "createAnnotation">;

/**
 * Writes a parsed session as a new project. `paths` are the picked files, one
 * per recording. `clipFiles` gives a clip, by index, the cut file it arrived with.
 */
export const writeSession = (
  session: ParsedSession, paths: string[], store: SessionStore,
  clipFiles: Array<{ output: string; thumbnail: string } | null> = [],
): Project => {
  const uidOf = (row: { uid: string | null }) => row.uid ?? undefined;
  const project = store.createProject({
    name: session.project.name,
    video_path: paths[0],
    video_name: path.basename(paths[0]),
    description: session.project.description || undefined,
  }, { uid: uidOf(session.project), recordingUid: uidOf(session.recordings[0]) });

  const projectId = project.id;
  if (!projectId) throw invalid();
  paths.slice(1).forEach((file, index) =>
    store.addProjectVideo(projectId, file, path.basename(file), uidOf(session.recordings[index + 1])));

  // Parents first, then children, so a child's parent already has an id.
  const categoryKeyToId = new Map<string, number>();
  const parentsFirst = [
    ...session.categories.filter(cat => !cat.parentKey),
    ...session.categories.filter(cat => cat.parentKey),
  ];
  for (const cat of parentsFirst) {
    const created = store.createCategory({
      name: cat.name,
      color: cat.color,
      description: cat.description || undefined,
      parent_id: cat.parentKey ? categoryKeyToId.get(cat.parentKey) : undefined,
      project_id: projectId,
    }, uidOf(cat));
    if (created.id) categoryKeyToId.set(cat.key, created.id);
  }

  const playerKeyToId = new Map<string, number>();
  for (const player of session.players) {
    const created = store.createPlayer({ name: player.name, number: player.number, project_id: projectId }, uidOf(player));
    if (created.id) playerKeyToId.set(player.key, created.id);
  }

  for (const [index, clip] of session.clips.entries()) {
    const ids = (keys: string[], map: Map<string, number>) =>
      JSON.stringify(keys.map(key => map.get(key)).filter((id): id is number => id !== undefined));
    store.createClip({
      project_id: projectId,
      video_path: paths[clip.recording],
      output_path: clipFiles[index]?.output ?? "",
      thumbnail_path: clipFiles[index]?.thumbnail ?? "",
      start_time: clip.startTime,
      end_time: clip.endTime,
      duration: clip.duration,
      title: clip.title,
      categories: ids(clip.categoryKeys, categoryKeyToId),
      players: ids(clip.playerKeys, playerKeyToId),
      quarter: clip.quarter,
      notes: clip.notes || undefined,
      court_x: clip.courtX,
      court_y: clip.courtY,
      status: clip.status,
    }, uidOf(clip));
  }

  for (const drawing of session.drawings) {
    store.createAnnotation({
      project_id: projectId,
      video_path: paths[drawing.recording],
      timestamp: drawing.timestamp,
      data: drawing.data,
      display_seconds: drawing.displaySeconds,
      pause_playback: drawing.pausePlayback,
    }, uidOf(drawing));
  }
  return project;
};
