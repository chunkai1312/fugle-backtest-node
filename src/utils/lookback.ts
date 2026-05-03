export function lookback<T>(series: T[], i: number, n: number): T | undefined {
  if (n < 0) {
    throw new RangeError('lookback: n must be non-negative');
  }
  const target = i - n;
  if (target < 0 || target >= series.length) return undefined;
  return series[target];
}

export function barsSince(condition: boolean[], i: number): number {
  if (i < 0 || i >= condition.length) return Infinity;
  for (let j = i; j >= 0; j--) {
    if (condition[j]) return i - j;
  }
  return Infinity;
}
