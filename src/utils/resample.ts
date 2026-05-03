import { DateTime } from 'luxon';

export type ResampleRule = 'W' | 'M' | 'Q' | 'Y';

export function bucketKey(date: string, rule: ResampleRule): string {
  const dt = DateTime.fromISO(date);
  switch (rule) {
    case 'W':
      return `${dt.weekYear}-W${dt.weekNumber}`;
    case 'M':
      return `${dt.year}-${dt.month}`;
    case 'Q':
      return `${dt.year}-Q${dt.quarter}`;
    case 'Y':
      return `${dt.year}`;
    /* istanbul ignore next */
    default:
      throw new RangeError(`Unknown resample rule: ${String(rule)}`);
  }
}

export function resampleApply(
  dates: string[],
  values: number[],
  rule: ResampleRule,
  fn: (bucket: number[]) => number,
): number[] {
  if (dates.length !== values.length) {
    throw new TypeError('resampleApply: dates and values must be the same length');
  }
  if (dates.length === 0) return [];

  const keys = dates.map(d => bucketKey(d, rule));
  const grouped = new Map<string, number[]>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const bucket = grouped.get(k);
    if (bucket) bucket.push(values[i]);
    else grouped.set(k, [values[i]]);
  }

  const aggregated = new Map<string, number>();
  grouped.forEach((bucket, k) => aggregated.set(k, fn(bucket)));

  return keys.map(k => aggregated.get(k) as number);
}
