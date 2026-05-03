/**
 * 03 — Trailing stop loss
 *
 * Enter long with a 5% trailing stop and inspect the SL ratchet.
 *
 *   yarn example examples/03-trailing-stop.ts
 */

import { Backtest, Strategy, Context, crossover } from '../lib';
import { SMA } from 'technicalindicators';
import * as path from 'path';

const data = require(path.join(__dirname, 'data/2330.json'));

class TrailingSmaBreakout extends Strategy {
  params = { period: 20, trailPercent: 0.05 };

  init(): void {
    const close = this.data.close;
    const sma = SMA.calculate({ period: this.params.period, values: close });
    this.addIndicator('SMA', sma, { overlay: true, color: '#9467bd' });
    // Pad SMA to match `data.length` (addIndicator left-pads automatically).
    const sma20 = this.getIndicator('SMA') as number[];
    this.addSignal('breakout', crossover(close, sma20));
  }

  next(ctx: Context): void {
    if (ctx.index < this.params.period) return;
    // Open a long position with a 5% trailing stop on each fresh breakout.
    if (ctx.signals.get('breakout') && this.trades.length === 0) {
      this.buy({ size: 500, trailPercent: this.params.trailPercent });
    }
  }
}

async function main(): Promise<void> {
  const backtest = new Backtest(data, TrailingSmaBreakout, {
    cash: 1_000_000,
    tradeOnClose: true,
  });
  const stats = await backtest.run();
  stats.print();

  // Snapshot the closed trades to confirm trailing actually moved the SL.
  const trades = stats.tradeLog ?? [];
  console.log(`\nClosed trades: ${trades.length}`);
  for (const t of trades.slice(0, 3)) {
    console.log(
      `  ${t['Entry Time']} → ${t['Exit Time']}  size=${t.Size}  ` +
      `entry=${t['Entry Price']}  exit=${t['Exit Price']}  PnL%=${(t['Return (%)'] * 100).toFixed(2)}`,
    );
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
