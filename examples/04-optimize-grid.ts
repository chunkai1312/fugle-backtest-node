/**
 * 04 — Optimize a parameter grid
 *
 * Searches an SMA(n1, n2) grid using:
 *   - constraint:    skip combinations where n1 >= n2
 *   - maxTries:      sample at most 12 of the valid combinations
 *   - maximize:      a custom function = Sharpe / |MaxDrawdown|
 *   - returnHeatmap: collect a 2D parameter heatmap
 *
 * Then renders the heatmap to a separate HTML file via `Plotting.plotHeatmap`.
 *
 *   yarn example examples/04-optimize-grid.ts
 */

import {
  Backtest,
  Strategy,
  Context,
  Plotting,
  StatsIndex,
  crossover,
  crossunder,
} from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class SmaCross extends Strategy {
  params = { n1: 5, n2: 60 };

  init(): void {
    const close = this.data.close;
    const a = SMA.calculate({ period: this.params.n1, values: close });
    const b = SMA.calculate({ period: this.params.n2, values: close });
    this.addIndicator('A', a);
    this.addIndicator('B', b);
    this.addSignal('up', crossover(this.getIndicator('A') as number[], this.getIndicator('B') as number[]));
    this.addSignal('down', crossunder(this.getIndicator('A') as number[], this.getIndicator('B') as number[]));
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.n2) return;
    if (ctx.signals.get('up')) this.buy({ size: 1000 });
    if (ctx.signals.get('down')) this.sell({ size: 1000 });
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, SmaCross, { cash: 1_000_000, tradeOnClose: true });

  const result = await backtest.optimize({
    params: {
      n1: [5, 10, 15, 20, 30],
      n2: [40, 60, 90, 120, 180],
    },
    constraint: (p) => p.n1 < p.n2,
    maxTries: 12,
    seed: 42,
    maximize: (results) => {
      const sharpe = Number(results[StatsIndex.SharpeRatio]) || 0;
      const maxDD = Math.abs(Number(results[StatsIndex.MaxDrawdown]) || 1);
      return sharpe / maxDD;
    },
    returnHeatmap: true,
    returnAll: true,
  });

  console.log(`Best params: ${JSON.stringify(result.bestParams)}`);
  console.log(`Best score (Sharpe / |MaxDD|): ${result.bestScore.toFixed(4)}`);
  console.log(`Combinations evaluated: ${result.all?.length ?? 0}`);

  // Render the heatmap (Sharpe / |MaxDD|) over the (n1, n2) grid:
  if (result.heatmap) {
    new Plotting(result.best, { openBrowser: false }).plotHeatmap(result.heatmap, {
      filename: 'optimize-heatmap.html',
    });
    console.log('Wrote optimize-heatmap.html');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
