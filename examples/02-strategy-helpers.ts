/**
 * 02 — Strategy helpers
 *
 * Demonstrates the pure-function helpers shipped from the package root:
 *   - crossover / crossunder — boolean[] indicating moving-average crosses
 *   - lookback — read prior-bar values without index gymnastics
 *   - barsSince — how many bars since a condition was last true
 *   - resampleApply — aggregate a daily series to weekly/monthly buckets and broadcast back
 *
 *   yarn example examples/02-strategy-helpers.ts
 */

import {
  crossover,
  crossunder,
  lookback,
  barsSince,
  resampleApply,
  mean,
} from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

interface Candle { date: string; open: number; high: number; low: number; close: number; volume: number }

const data: Candle[] = require(path.join(__dirname, 'data/2330.json'));

async function main(): Promise<void> {
  const sortedData = [...data].sort((a, b) => (a.date < b.date ? -1 : 1));
  const dates = sortedData.map(d => d.date);
  const close = sortedData.map(d => d.close);

  // crossover / crossunder
  const sma20 = SMA.calculate({ period: 20, values: close });
  const sma60 = SMA.calculate({ period: 60, values: close });
  // Pad SMA arrays to match `close.length` (left-fill with NaN).
  const padded = (arr: number[], target: number): number[] =>
    Array(target - arr.length).fill(NaN).concat(arr);
  const sma20Padded = padded(sma20, close.length);
  const sma60Padded = padded(sma60, close.length);
  const crossUp = crossover(sma20Padded, sma60Padded);
  const crossDown = crossunder(sma20Padded, sma60Padded);
  const upCount = crossUp.filter(Boolean).length;
  const downCount = crossDown.filter(Boolean).length;
  console.log(`SMA(20) crossed above SMA(60) ${upCount} times, below ${downCount} times.`);

  // lookback — close 5 bars ago, at the latest bar
  const last = close.length - 1;
  console.log(`Latest close: ${close[last]}; 5 bars ago: ${lookback(close, last, 5)}`);

  // barsSince — how many bars since the most recent crossUp
  const since = barsSince(crossUp, last);
  console.log(`Bars since the most recent SMA(20) > SMA(60) cross: ${since}`);

  // resampleApply — weekly mean of close, broadcast back to daily index
  const weeklyMean = resampleApply(dates, close, 'W', mean);
  console.log(`Weekly-mean close[last] = ${weeklyMean[last]}; daily close[last] = ${close[last]}.`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
