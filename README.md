# Backtesting TS

[![NPM version][npm-image]][npm-url]
[![Build Status][action-image]][action-url]
[![Coverage Status][codecov-image]][codecov-url]

> A trading strategy backtesting library in Node.js inspired by [backtesting.py](https://github.com/kernc/backtesting.py).

## Installation

```sh
$ npm install --save node-backtesting
```

## Importing

```js
// Using Node.js `require()`
const { Backtest, Strategy } = require('node-backtesting');

// Using ES6 imports
import { Backtest, Strategy } from 'node-backtesting';
```

## Quick Start

The following example use [technicalindicators](https://github.com/anandanand84/technicalindicators) to calculate the indicators and signals, but you can replace it with any library.


```js
import { Backtest, Strategy, crossover, crossunder } from 'node-backtesting';
import { SMA } from 'technicalindicators';

class SmaCross extends Strategy {
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

    this.addSignal('crossUp', crossover(this.getIndicator('lineA'), this.getIndicator('lineB')));
    this.addSignal('crossDown', crossunder(this.getIndicator('lineA'), this.getIndicator('lineB')));
  }

  next(ctx) {
    const { index, signals } = ctx;
    if (index < this.params.n1 || index < this.params.n2) return;
    if (signals.get('crossUp')) this.buy({ size: 1000 });
    if (signals.get('crossDown')) this.sell({ size: 1000 });
  }
}

const data = require('./data.json');  // historical OHLCV data

const backtest = new Backtest(data, SmaCross, {
  cash: 1000000,
  tradeOnClose: true,
});

backtest.run()        // run the backtest
  .then(results => {
    results.print();  // print the results
    results.plot();   // plot the equity curve
  });
```

Results in:

```
┌────────────────────────┬─────────────────────────┐
│ (index)                │ Values                  │
├────────────────────────┼─────────────────────────┤
│ Strategy               │ 'SmaCross(n1=20,n2=60)' │
│ Start                  │ '2020-01-02'            │
│ End                    │ '2022-12-30'            │
│ Duration               │ 1093                    │
│ Exposure Time [%]      │ 55.102041               │
│ Equity Final [$]       │ 1105000                 │
│ Equity Peak [$]        │ 1378000                 │
│ Return [%]             │ 10.5                    │
│ Buy & Hold Return [%]  │ 32.300885               │
│ Return (Ann.) [%]      │ 3.482537                │
│ Volatility (Ann.) [%]  │ 8.204114                │
│ Sharpe Ratio           │ 0.424487                │
│ Sortino Ratio          │ 0.660431                │
│ Calmar Ratio           │ 0.175785                │
│ Max. Drawdown [%]      │ -19.811321              │
│ Avg. Drawdown [%]      │ -2.241326               │
│ Max. Drawdown Duration │ 708                     │
│ Avg. Drawdown Duration │ 54                      │
│ # Trades               │ 6                       │
│ Win Rate [%]           │ 16.666667               │
│ Best Trade [%]         │ 102.3729                │
│ Worst Trade [%]        │ -10.4418                │
│ Avg. Trade [%]         │ 5.718878                │
│ Max. Trade Duration    │ 322                     │
│ Avg. Trade Duration    │ 100                     │
│ Profit Factor          │ 2.880822                │
│ Expectancy [%]         │ 11.139483               │
│ SQN                    │ 0.305807                │
│ Avg. Win [%]           │ 102.3729                │
│ Avg. Loss [%]          │ -7.1072                 │
│ Win/Loss Ratio         │ 14.404111               │
│ Kelly Criterion        │ 0.108813                │
└────────────────────────┴─────────────────────────┘
```

![](./assets/plot.png)

## Usage

To perform backtesting, you need to prepare historical data, implement a trading strategy, and then run a backtest on that strategy to obtain the results.

### Preparing historical data

First, prepare the historical OHLCV (Open, High, Low, Close, Volume) data of any financial instrument (such as stocks, futures, forex, cryptocurrencies, etc.). The input historical data will be normalized into a `HistoricalData` columnar object with arrays for each field, and the input format can be either `Array<Candle>` (row form) or `CandleList` (column form):

```ts
interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandleList {
  date: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume?: number[];
}

type HistoricalDataInput = Array<Candle> | CandleList;
```

Inside a strategy, `this.data` exposes typed columnar arrays — `this.data.close` and `this.data['close']` both return the same `number[]`.

### Implementing trading strategy

You can implement your own trading strategy by inheriting the `Strategy` class and overriding its two abstract methods:

- `Strategy.init(data)`: This method is called before running the strategy. You can pre-calculate all indicators and signals that the strategy depends on.
- `Strategy.next(context)`: This method will be iteratively called when running the strategy with the `Backtest` instance, and the `context` parameter represents the current candle and technical indicators and signals. You can decide whether to make buy or sell actions based on the current price, indicators, and signals.

Here's an example of implementing a simple average crossover strategy. The parameter `n1` represents the period of the short-term moving average, and `n2` represents the period of the long-term moving average. When the short-term moving average crosses above the long-term moving average, it buys `1000` trading unit. Conversely, when the short-term moving average crosses below the long-term moving average, the strategy sells `1000` trading unit.

```js
import { Backtest, Strategy, crossover, crossunder } from 'node-backtesting';
import { SMA } from 'technicalindicators';

class SmaCross extends Strategy {
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

    this.addSignal('crossUp', crossover(this.getIndicator('lineA'), this.getIndicator('lineB')));
    this.addSignal('crossDown', crossunder(this.getIndicator('lineA'), this.getIndicator('lineB')));
  }

  next(ctx) {
    const { index, signals } = ctx;
    if (index < this.params.n1 || index < this.params.n2) return;
    if (signals.get('crossUp')) this.buy({ size: 1000 });
    if (signals.get('crossDown')) this.sell({ size: 1000 });
  }
}
```

### Running the backtest

After preparing historical data and implementing the trading strategy, you can run the backtest. Calling the `Backtest.run()` method will execute the backtest and return a `Stats` instance, which includes the simulation results of our strategy and related statistical data.

```js
const backtest = new Backtest(data, SmaCross, {
  cash: 1000000,
  tradeOnClose: true,
});

backtest.run()        // run the backtest
  .then(results => {
    results.print();  // print the results
    results.plot();   // plot the equity curve
  });
```

### Optimizing the parameters

In the above strategy, we provide two variable parameters `params.n1` and `params.n2`, which represent the period of two moving averages. We can optimize the parameters and find the best combination of multiple parameters by calling the `Backtest.optimize()` method. Setting the `params` option in this method can change the parameter settings provided by the `Strategy`, and `Backtest.optimize()` will return the best combination of parameters provided.

```js
backtest.optimize({
  params: {
    n1: [5, 10, 20],
    n2: [60, 120, 240],
  },
  maximize: 'Sharpe Ratio',          // or pass a function `(results) => number`
  constraint: p => p.n1 < p.n2,      // skip invalid combos
  maxTries: 6,                       // randomly sample at most 6 combos
  seed: 42,                          // reproducible sampling
  returnHeatmap: true,               // attach a 2D heatmap of the first two params
})
  .then(({ best, bestParams, bestScore, heatmap }) => {
    best.print();                    // print stats of the winning combo
    best.plot();                     // plot equity curve of the winning combo
    console.log(bestParams, bestScore);
  });
```

`Backtest.optimize()` returns an `OptimizeResult` object:

| Field | Type | Notes |
| --- | --- | --- |
| `best` | `Stats` | Stats of the highest-scoring combination. |
| `bestParams` | `Record<string, number>` | The winning parameter combination. |
| `bestScore` | `number` | Score of `best` per `maximize`. |
| `heatmap` | `ParamHeatmap` (optional) | Present when `returnHeatmap: true`; built from the first two `params` keys. |
| `all` | `Array<{ params, score, stats }>` (optional) | Present when `returnAll: true`. |

`Backtest.stats` is also set to `result.best` so `backtest.print()` / `backtest.plot()` continue to work after `optimize()`.

### Plotting

`Backtest.plot()` (or `stats.plot()`) writes a self-contained HTML file with up to five hover-synchronized panels via [Plotly.js](https://plotly.com/javascript/):

1. **Price** — candlestick chart with indicator overlays and trade entry/exit markers
2. **Volume** — per-bar volume bars
3. **Equity** — equity-curve line
4. **Drawdown** — drawdown percentage with fill
5. **PnL** — per-trade return percentage, color-coded by sign

Panels can be toggled individually via `PlottingOptions`:

```js
backtest.plot({ plotVolume: false, plotDrawdown: false, openBrowser: false, filename: 'result.html' });
```

Indicators registered with `addIndicator(name, values, options)` honor:

- `overlay: true` (default) — draw on the price panel
- `overlay: false` — render in its own subplot between the price and volume panels (useful for RSI / MACD)
- `color` — line color in any CSS-compatible format

For optimization runs, `plotHeatmap(grid)` writes a separate 2D parameter heatmap:

```js
const result = await backtest.optimize({
  params: { n1: [5, 10, 20], n2: [60, 120, 240] },
  returnHeatmap: true,
});
new Plotting(result.best).plotHeatmap(result.heatmap, { filename: 'heatmap.html' });
```

### Trailing stop loss

Pass `trailPercent` (fractional, e.g. `0.05` for 5%) or `trailAmount` (absolute price units) to `buy()` / `sell()` to attach a trailing stop:

```js
// Long with 5% trailing stop:
this.buy({ size: 1000, trailPercent: 0.05 });

// Short with $5 trailing stop combined with a hard initial floor:
this.sell({ size: 1000, slPrice: 110, trailPercent: 0.05 });
```

The SL ratchets in the favorable direction every bar (`peakHigh * (1 - trailPercent)` for long, `peakLow * (1 + trailPercent)` for short) and never moves backward. `trade.isTrailing` and `trade.trailingDistance` let you inspect status mid-trade. Assigning `trade.sl = price` switches the trade back to a fixed SL.

### Strategy helpers

`node-backtesting` ships a small set of pure functions for common strategy patterns. Import them alongside `Strategy`:

```js
import { crossover, crossunder, lookback, barsSince, resampleApply } from 'node-backtesting';
```

| Helper | Signature | Notes |
| --- | --- | --- |
| `crossover(a, b)` | `(number[], number[]) => boolean[]` | `true` at index `i` when `a[i] > b[i] && a[i-1] <= b[i-1]`. NaN/null/undefined gates the result. |
| `crossunder(a, b)` | `(number[], number[]) => boolean[]` | Mirror of `crossover` for the down side. |
| `lookback(series, i, n)` | `<T>(T[], number, number) => T \| undefined` | Returns `series[i - n]`, or `undefined` if out of bounds. Throws `RangeError` on negative `n`. |
| `barsSince(condition, i)` | `(boolean[], number) => number` | Bars between `i` and the most recent `true` in `condition[0..i]`. `Infinity` if never true. |
| `resampleApply(dates, values, rule, fn)` | `(string[], number[], 'W'\|'M'\|'Q'\|'Y', (bucket: number[]) => number) => number[]` | Bucket by ISO week / month / quarter / year, apply `fn` per bucket, then forward-fill back to the daily index. |

These helpers are pure functions — feed them `number[]` from `this.data`, get arrays back; you decide whether to pass to `addSignal()` / `addIndicator()`.

## Examples

Six runnable end-to-end examples live under [`examples/`](./examples/) — each focuses on one feature so you can see exactly how it's wired:

| File | Focus |
| --- | --- |
| [`01-quickstart.ts`](./examples/01-quickstart.ts) | Minimum viable backtest. |
| [`02-strategy-helpers.ts`](./examples/02-strategy-helpers.ts) | `crossover` / `lookback` / `barsSince` / `resampleApply`. |
| [`03-trailing-stop.ts`](./examples/03-trailing-stop.ts) | `buy({ trailPercent })`. |
| [`04-optimize-grid.ts`](./examples/04-optimize-grid.ts) | `optimize()` + heatmap output. |
| [`05-multi-panel-plot.ts`](./examples/05-multi-panel-plot.ts) | Multi-panel plot with an oscillator subplot. |
| [`06-kelly-criterion.ts`](./examples/06-kelly-criterion.ts) | Kelly Criterion and trade-quality stats. |

Run any of them with the `example` script (which builds first):

```sh
yarn example examples/01-quickstart.ts
```

See [`examples/README.md`](./examples/README.md) for details.

## Documentation

See [`/doc/node-backtesting.md`](./doc/node-backtesting.md) for Node.js-like documentation of `node-backtesting` classes.

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-backtesting.svg
[npm-url]: https://npmjs.com/package/node-backtesting
[action-image]: https://img.shields.io/github/actions/workflow/status/chunkai1312/node-backtesting/node.js.yml?branch=master
[action-url]: https://github.com/chunkai1312/node-backtesting/actions/workflows/node.js.yml
[codecov-image]: https://img.shields.io/codecov/c/github/chunkai1312/node-backtesting.svg
[codecov-url]: https://codecov.io/gh/chunkai1312/node-backtesting
