export interface Killable {
  kill(signal?: string): unknown;
}

type Step = "thumb" | "encode";

// A cut runs two ffmpeg steps, thumbnail then encode, with gaps before each
// one registers its command. A cancel that lands in a gap is remembered, so the
// next step is killed as soon as it starts and the cut can check before it.
export class ClipCuts {
  private readonly running = new Set<string>();
  private readonly cancelled = new Set<string>();
  private readonly commands = new Map<string, Killable>();

  start(id: string): void {
    this.running.add(id);
  }

  track(id: string, step: Step, command: Killable): void {
    if (this.cancelled.has(id)) {
      command.kill();
      return;
    }
    this.commands.set(`${id}:${step}`, command);
  }

  untrack(id: string, step: Step): void {
    this.commands.delete(`${id}:${step}`);
  }

  isCancelled(id: string): boolean {
    return this.cancelled.has(id);
  }

  /** Returns false when no cut with this id is in progress. */
  cancel(id: string): boolean {
    if (!this.running.has(id)) return false;
    this.cancelled.add(id);
    for (const step of ["thumb", "encode"] as const) {
      this.commands.get(`${id}:${step}`)?.kill();
      this.untrack(id, step);
    }
    return true;
  }

  finish(id: string): void {
    this.running.delete(id);
    this.cancelled.delete(id);
    this.untrack(id, "thumb");
    this.untrack(id, "encode");
  }
}
