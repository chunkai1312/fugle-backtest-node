/**
 * Seedable PRNG (mulberry32). Returns a function producing uniform `[0, 1)` floats.
 * Same `seed` reproduces the same sequence; period is 2^32 (sufficient for sampling
 * up to a few thousand combinations).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample `k` distinct elements from `arr` uniformly at random using the supplied PRNG.
 * If `k >= arr.length`, returns a shuffled full copy. `k <= 0` returns `[]`.
 */
export function sampleWithoutReplacement<T>(arr: T[], k: number, rng: () => number): T[] {
  if (k <= 0) return [];
  if (k >= arr.length) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  // Partial Fisher-Yates: take `k` swaps from the end.
  const copy = arr.slice();
  const n = copy.length;
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}
