export const projectPlaybackKey = (projectId: number) => `projectPlayback:${projectId}`;

export const resumePosition = (saved: unknown, duration: number): number =>
  typeof saved === "number" && Number.isFinite(saved) && saved > 0 && saved < duration
    ? saved
    : 0;
