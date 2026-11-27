/**
 * Paths main's own file picker returned to the renderer, so a later IPC call
 * can prove the coach picked the path it sends back. Each one is good for a
 * single use within `ttlMs`.
 */
export const createPickedPaths = (ttlMs: number, now: () => number = Date.now) => {
  const picked = new Map<string, number>();
  return {
    remember: (file: string): void => {
      picked.set(file, now() + ttlMs);
    },
    /** True once for a path the picker returned and that has not expired; it is forgotten either way. */
    consume: (file: unknown): boolean => {
      if (typeof file !== "string") return false;
      const expires = picked.get(file);
      picked.delete(file);
      return expires !== undefined && now() <= expires;
    },
  };
};
