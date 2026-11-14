export interface Killable {
  kill(): unknown;
}

// A cut is stored as `${id}-thumb` while it grabs the thumbnail, then as `id`
// while it encodes, so cancelling has to look under both keys.
export const cancelClipProcess = (
  processes: Map<string, Killable>,
  processId: string,
): boolean => {
  let found = false;
  for (const key of [processId, `${processId}-thumb`]) {
    const command = processes.get(key);
    if (command) {
      command.kill();
      processes.delete(key);
      found = true;
    }
  }
  return found;
};
