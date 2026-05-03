/**
 * 06 — Kelly Criterion and trade-quality stats
 *
 * Highlights the trade-aggregate metrics added by the Kelly change:
 *   - Avg. Win [%], Avg. Loss [%], Win/Loss Ratio
 *   - Kelly Criterion (= p − q/b)
 *
 * Useful for sanity-checking whether a strategy has positive expected value
 * before deploying real capital.
 *
 *   yarn example examples/06-kelly-criterion.ts
 */

import { Backtest, Strategy, Context, StatsIndex, crossover, crossunder } from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class SmaCross extends Strategy {
  params = { n1: 20, n2: 60 };

  init(): void {
    const close = this.data.close;
    this.addIndicator('A', SMA.calculate({ period: this.params.n1, values: close }));
    this.addIndicator('B', SMA.calculate({ period: this.params.n2, values: close }));
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
  const stats = await backtest.run();
  const r = stats.results;
  if (!r) throw new Error('no results');

  console.log('--- Trade quality ---');
  console.log(`# Trades:         ${r[StatsIndex.Trades]}`);
  console.log(`Win Rate [%]:     ${Number(r[StatsIndex.WinRate]).toFixed(2)}`);
  console.log(`Avg. Win [%]:     ${Number(r[StatsIndex.AvgWinPct]).toFixed(4)}`);
  console.log(`Avg. Loss [%]:    ${Number(r[StatsIndex.AvgLossPct]).toFixed(4)}`);
  console.log(`Win/Loss Ratio:   ${Number(r[StatsIndex.WinLossRatio]).toFixed(4)}`);
  console.log(`Profit Factor:    ${Number(r[StatsIndex.ProfitFactor]).toFixed(4)}`);
  console.log(`Kelly Criterion:  ${Number(r[StatsIndex.KellyCriterion]).toFixed(4)}`);

  const kelly = Number(r[StatsIndex.KellyCriterion]);
  if (Number.isNaN(kelly)) {
    console.log('\n(No trades — Kelly is undefined.)');
  } else if (kelly <= 0) {
    console.log('\nNegative Kelly: strategy has non-positive expected value. Do not size up.');
  } else {
    console.log(`\nPositive Kelly: full-Kelly position sizing = ${(kelly * 100).toFixed(2)}% of bankroll.`);
    console.log(`Practitioners often use 1/4 Kelly = ${(kelly * 25).toFixed(2)}% to dampen variance.`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
