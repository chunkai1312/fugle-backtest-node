export function cumMax(xs: number[]): number[] {
  const out = new Array<number>(xs.length);
  let runningMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (Number.isNaN(v)) {
      out[i] = NaN;
    } else {
      if (v > runningMax) runningMax = v;
      out[i] = runningMax;
    }
  }
  return out;
}

export function fillNa(xs: number[], value = 0): number[] {
  return xs.map(v => (Number.isNaN(v) ? value : v));
}

export function sum(xs: number[]): number {
  let total = 0;
  for (const v of xs) {
    if (!Number.isNaN(v)) total += v;
  }
  return total;
}

export function mean(xs: number[]): number {
  let total = 0;
  let count = 0;
  for (const v of xs) {
    if (!Number.isNaN(v)) {
      total += v;
      count++;
    }
  }
  return count === 0 ? NaN : total / count;
}

export function max(xs: number[]): number {
  let result = Number.NEGATIVE_INFINITY;
  let found = false;
  for (const v of xs) {
    if (!Number.isNaN(v)) {
      if (v > result) result = v;
      found = true;
    }
  }
  return found ? result : NaN;
}

export function min(xs: number[]): number {
  let result = Number.POSITIVE_INFINITY;
  let found = false;
  for (const v of xs) {
    if (!Number.isNaN(v)) {
      if (v < result) result = v;
      found = true;
    }
  }
  return found ? result : NaN;
}

/**
 * Sample variance (ddof=1), skipping NaN. Matches pandas/danfojs default.
 */
export function variance(xs: number[]): number {
  let count = 0;
  let total = 0;
  for (const v of xs) {
    if (!Number.isNaN(v)) {
      total += v;
      count++;
    }
  }
  if (count < 2) return NaN;
  const m = total / count;
  let sumSq = 0;
  for (const v of xs) {
    if (!Number.isNaN(v)) sumSq += (v - m) ** 2;
  }
  return sumSq / (count - 1);
}

export function stddev(xs: number[]): number {
  const v = variance(xs);
  return Number.isNaN(v) ? NaN : Math.sqrt(v);
}

/**
 * Geometric mean of returns: `exp(mean(log(1 + r))) - 1`.
 *
 * NaN values are treated as 0 (no return). Returns 0 if any return <= -1
 * (would imply log of zero/negative). Returns NaN for an empty input.
 */
export function geometricMean(returns: number[]): number {
  if (returns.length === 0) return NaN;
  let sumLog = 0;
  for (const raw of returns) {
    const r = Number.isNaN(raw) ? 0 : raw;
    if (r <= -1) return 0;
    sumLog += Math.log(1 + r);
  }
  return Math.exp(sumLog / returns.length) - 1;
}
