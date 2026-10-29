/** Counts falls by the platform the player last stood on. Shows which jumps are too hard. */
export class FallLog {
  private counts = new Map<string, number>();

  record(platformId: string | null): void {
    if (platformId) this.counts.set(platformId, (this.counts.get(platformId) ?? 0) + 1);
  }

  /** The platform you fell from most often (the earliest one if tied), or null if no falls. */
  worst(): { id: string; count: number } | null {
    let best: { id: string; count: number } | null = null;
    for (const [id, count] of this.counts) {
      if (!best || count > best.count) best = { id, count };
    }
    return best;
  }

  get total(): number {
    let sum = 0;
    for (const c of this.counts.values()) sum += c;
    return sum;
  }

  reset(): void {
    this.counts.clear();
  }
}
