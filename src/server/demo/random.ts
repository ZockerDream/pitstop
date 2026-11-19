/** Seedbarer Zufallsgenerator (mulberry32): gleicher Seed → gleiche Demo-Daten. */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  static fromString(s: string): Random {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return new Random(h);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl zwischen min und max (beide inklusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [value, weight] of entries) {
      r -= weight;
      if (r < 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  /** Betrag in Cent, auf `step` Cent gerundet. */
  amount(minCents: number, maxCents: number, step = 500): number {
    return Math.round(this.int(minCents, maxCents) / step) * step;
  }
}
