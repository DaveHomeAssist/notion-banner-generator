// Deterministic seeded randomness. Identical seed strings always yield the same
// sequence, so a banner is fully reproducible from (preset + content + seed).

/** xmur3 string hash -> 32-bit seed. */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG. Fast, good-enough distribution for visual seeding. */
export interface Rng {
  /** float in [0, 1). */
  next(): number;
  /** int in [min, max]. */
  int(min: number, max: number): number;
  /** float in [min, max). */
  range(min: number, max: number): number;
  /** pick one element. */
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: string): Rng {
  let a = xmur3(seed || "notion-banner-generator");
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
