// Fixtures for shareDiff.test.mts and shareMerge.test.mts. It has no tests of its own.
import { DatabaseSync } from "node:sqlite";
import { addPermanentIds } from "./permanentIds.ts";
import { migrateProjectVideos } from "./projectVideos.ts";
import type { ParsedSession } from "./sessionData.ts";
import { createShareSnapshotsTable } from "./shareSnapshots.ts";

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const PROJECT = uid(100);
export const R1 = uid(1), R2 = uid(2);
export const OFFENSE = uid(10), PNR = uid(11), DEFENSE = uid(12), PRESS = uid(13);
export const ANA = uid(20), BEA = uid(21), CAT = uid(22);
export const C1 = uid(31), C2 = uid(32), C3 = uid(33), C4 = uid(34), C5 = uid(35);
export const D1 = uid(41), D2 = uid(42);

type Clip = ParsedSession["clips"][number];
export const clip = (id: string, title: string, start: number, extra: Partial<Clip> = {}): Clip => ({
  uid: id, recording: 0, recordingUid: R1, categoryKeys: [OFFENSE], playerKeys: [ANA],
  title, startTime: start, endTime: start + 5, duration: 5, quarter: "Q1", notes: "", courtX: null, courtY: null,
  status: null, ...extra,
});

/** The project as it was shared: one recording, four clips, one drawing, three categories, two players. */
export const baseSession = (): ParsedSession => ({
  version: 4,
  project: { uid: PROJECT, name: "Derby", description: "" },
  recordings: [{ uid: R1, videoName: "game.mp4" }],
  categories: [
    { uid: OFFENSE, key: OFFENSE, parentKey: null, name: "Offense", color: "#b15f43", description: "" },
    { uid: PNR, key: PNR, parentKey: OFFENSE, name: "Pick & Roll", color: "#a94ebc", description: "" },
    { uid: DEFENSE, key: DEFENSE, parentKey: null, name: "Defense", color: "#3b7b9b", description: "" },
  ],
  players: [
    { uid: ANA, key: ANA, name: "Ana", number: "4" },
    { uid: BEA, key: BEA, name: "Bea", number: "7" },
  ],
  clips: [clip(C1, "Fast break", 10), clip(C2, "Zone press", 30, { categoryKeys: [DEFENSE] }),
    clip(C3, "Turnover", 50), clip(C4, "Corner three", 70, { categoryKeys: [PNR], playerKeys: [ANA, BEA] })],
  drawings: [{
    uid: D1, recording: 0, recordingUid: R1, timestamp: 12, displaySeconds: null, pausePlayback: false,
    data: JSON.stringify([{ id: "s1", tool: "arrow", color: "#ff0000", widthFrac: 0.01, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }]),
  }],
});

export const edit = (session: ParsedSession, change: (copy: ParsedSession) => void): ParsedSession => {
  const copy = structuredClone(session);
  change(copy);
  return copy;
};

export const clipOf = (session: ParsedSession, id: string) => session.clips.find(row => row.uid === id)!;

/** The four tables a merge writes, as database.ts creates them; shareApply.test.mts checks they still match. */
export const SCHEMA = `
  CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, video_path TEXT NOT NULL,
    video_name TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_opened DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL,
    description TEXT, parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(name, parent_id, project_id));
  CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, number TEXT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(name, project_id));
  CREATE TABLE clips (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, video_path TEXT NOT NULL,
    output_path TEXT NOT NULL, thumbnail_path TEXT, start_time REAL NOT NULL, end_time REAL NOT NULL,
    duration REAL NOT NULL, title TEXT NOT NULL, categories TEXT NOT NULL, players TEXT DEFAULT '[]', quarter TEXT,
    court_x REAL, court_y REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    drawings_key TEXT, overlay_path TEXT,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE);
  CREATE TABLE annotations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
    video_path TEXT NOT NULL, timestamp REAL NOT NULL, data TEXT NOT NULL, display_seconds REAL,
    pause_playback INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE);
`;

/** A real-schema database with project 1 on /v/game.mp4, after the permanent-id migration. */
export const schema = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  db.exec("INSERT INTO projects (name, video_path, video_name) VALUES ('Derby', '/v/game.mp4', 'game.mp4')");
  migrateProjectVideos(db);
  addPermanentIds(db);
  createShareSnapshotsTable(db);
  return db;
};

/**
 * Writes a session's rows into project 1 by uid, the way database.ts's
 * create functions store them: empty text as NULL. Clip files are /clips/<title>.mp4.
 */
export const seed = (db: DatabaseSync, session: ParsedSession) => {
  db.prepare("UPDATE project_videos SET uid = ? WHERE project_id = 1").run(R1);
  const idOf = (table: string, id: string) =>
    (db.prepare(`SELECT id FROM ${table} WHERE uid = ?`).get(id) as { id: number }).id;
  for (const cat of [...session.categories].sort((a, b) => Number(!!a.parentKey) - Number(!!b.parentKey))) {
    db.prepare("INSERT INTO categories (name, color, description, parent_id, project_id, uid) VALUES (?, ?, ?, ?, 1, ?)")
      .run(cat.name, cat.color, cat.description || null, cat.parentKey ? idOf("categories", cat.parentKey) : null, cat.uid);
  }
  for (const player of session.players) {
    db.prepare("INSERT INTO players (name, number, project_id, uid) VALUES (?, ?, 1, ?)")
      .run(player.name, player.number || null, player.uid);
  }
  for (const row of session.clips) {
    db.prepare(`INSERT INTO clips (project_id, video_path, output_path, thumbnail_path, start_time, end_time, duration,
      title, categories, players, quarter, notes, status, uid) VALUES (1, '/v/game.mp4', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`/clips/${row.title}.mp4`, `/clips/${row.title}.jpg`, row.startTime, row.endTime, row.duration, row.title,
        JSON.stringify(row.categoryKeys.map(key => idOf("categories", key))),
        JSON.stringify(row.playerKeys.map(key => idOf("players", key))), row.quarter || null, row.notes || null,
        row.status, row.uid);
  }
  for (const drawing of session.drawings) {
    db.prepare("INSERT INTO annotations (project_id, video_path, timestamp, data, display_seconds, uid) VALUES (1, '/v/game.mp4', ?, ?, ?, ?)")
      .run(drawing.timestamp, drawing.data, drawing.displaySeconds, drawing.uid);
  }
};
