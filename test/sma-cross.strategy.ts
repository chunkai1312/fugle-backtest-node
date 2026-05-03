import { Strategy, Context, crossover, crossunder } from '../src';
import { SMA } from 'technicalindicators';

export class SmaCross extends Strategy {
  params = { n1: 20, n2: 60 };

  init() {
    const lineA = SMA.calculate({
      period: this.params.n1,
      values: this.data['close'],
    });
    this.addIndicator('lineA', lineA, { overlay: true, color: '#1f77b4' });

    const lineB = SMA.calculate({
      period: this.params.n2,
      values: this.data['close'],
    });
    this.addIndicator('lineB', lineB, { overlay: true, color: '#ff7f0e' });

    const a = this.getIndicator('lineA') as number[];
    const b = this.getIndicator('lineB') as number[];
    this.addSignal('crossUp', crossover(a, b));
    this.addSignal('crossDown', crossunder(a, b));
  }

  next(ctx: Context) {
    const { index, signals } = ctx;
    if (index < this.params.n1 || index < this.params.n2) return;
    const price = ctx.data['close'];
    if (signals.get('crossUp')) this.buy({ size: 1000, tpPrice: price * 1.15, slPrice: price * 0.9 });
    if (signals.get('crossDown')) this.sell({ size: 1000 });
  }
}
