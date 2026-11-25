export const projectPlaybackKey = (projectId: number, recordingId?: number) =>
  recordingId === undefined ? `projectPlayback:${projectId}` : `projectPlayback:${projectId}:${recordingId}`;

export const activeRecordingKey = (projectId: number) => `activeRecording:${projectId}`;

export const resumePosition = (saved: unknown, duration: number): number =>
  typeof saved === "number" && Number.isFinite(saved) && saved > 0 && saved < duration
    ? saved
    : 0;

export const projectPrefKeys = (projectId: number, recordingIds: number[]): string[] => [
  projectPlaybackKey(projectId),
  ...recordingIds.map(id => projectPlaybackKey(projectId, id)),
  activeRecordingKey(projectId),
];
