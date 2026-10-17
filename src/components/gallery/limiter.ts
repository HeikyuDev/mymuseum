// A small priority-aware concurrency limiter for photo downloads.

type Waiter = { priority: number; wake: () => void };

export class Limiter {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  get running(): number {
    return this.active;
  }

  /** Resolves when a slot is yours. Lower priority numbers go first (the artwork in front of the camera beats a far neighbour). */
  async acquire(limit: number, priority: number): Promise<void> {
    if (this.active < limit) {
      this.active += 1;
      return;
    }
    // The releasing side takes the slot on our behalf before waking us, so a burst can never exceed the limit.
    await new Promise<void>((resolve) => {
      const at = this.waiting.findIndex((item) => item.priority > priority);
      this.waiting.splice(at < 0 ? this.waiting.length : at, 0, { priority, wake: resolve });
    });
  }

  release(limit: number): void {
    this.active -= 1;
    while (this.waiting.length > 0 && this.active < limit) {
      this.active += 1;
      this.waiting.shift()?.wake();
    }
  }
}
