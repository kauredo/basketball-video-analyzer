// Fixtures for shareDiff.test.mts and shareMerge.test.mts. It has no tests of its own.
import type { ParsedSession } from "./sessionData.ts";

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
