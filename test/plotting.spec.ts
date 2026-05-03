import * as open from 'open';
import { minify } from 'html-minifier';
import { Plotting } from '../src/plotting';
import { Backtest } from '../src/backtest';
import { Stats } from '../src/stats';
import { ParamHeatmap } from '../src/interfaces';
import { SmaCross } from './sma-cross.strategy';

jest.mock('fs');
jest.mock('open');
jest.mock('html-minifier');

const fixture = require('./fixtures/2330.json'); // eslint-disable-line @typescript-eslint/no-var-requires

const lastRawHtml = (): string => (minify as jest.Mock).mock.calls[0][0] as string;

describe('Plotting', () => {
  let backtest: Backtest;
  let stats: Stats;

  beforeEach(async () => {
    backtest = new Backtest(fixture, SmaCross, {
      cash: 1000000,
      commission: 0,
      margin: 1,
      tradeOnClose: false,
      hedging: false,
      exclusiveOrders: false,
    });
    stats = await backtest.run();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor()', () => {
    it('should set default options if not provided', () => {
      const plotting = new Plotting(stats);
      expect(plotting).toBeInstanceOf(Plotting);
      expect(plotting['openBrowser']).toBe(true);
      expect(plotting['filename']).toBe('output.html');
    });

    it('should set provided options', () => {
      const options = { openBrowser: false, filename: 'test.html' };
      const plotting = new Plotting(stats, options);
      expect(plotting).toBeInstanceOf(Plotting);
      expect(plotting['openBrowser']).toBe(false);
      expect(plotting['filename']).toBe('test.html');
    });
  });

  describe('.plot()', () => {
    it('should create the HTML file with minified content', () => {
      const options = { openBrowser: false, filename: 'test.html' };
      const plotting = new Plotting(stats, options);
      plotting.plot();
      expect(minify).toHaveBeenCalled();
      expect(open).not.toBeCalled();
    });

    it('should create the HTML file with minified content and open it in the browser', () => {
      const options = { openBrowser: true, filename: 'test.html' };
      const plotting = new Plotting(stats, options);
      plotting.plot();
      expect(minify).toHaveBeenCalled();
      expect(open).toHaveBeenCalledWith(`./${options.filename}`);
    });

    it('should embed Plotly.js (pinned) and no danfojs reference in the generated HTML', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('cdn.plot.ly/plotly-2.35.2.min.js');
      expect(html).toContain('Plotly.newPlot');
      expect(html).not.toContain('danfojs');
      expect(html).not.toContain('dfd.DataFrame');
    });

    it('renders four panels by default in Equity → PnL → Price → Volume order', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Four Y-axis groups
      expect(html).toContain('"yaxis"');
      expect(html).toContain('"yaxis2"');
      expect(html).toContain('"yaxis3"');
      expect(html).toContain('"yaxis4"');
      expect(html).not.toContain('"yaxis5"');
      // Each panel's representative trace is present:
      expect(html).toContain('"name":"Equity"');
      expect(html).toContain('"name":"Volume"');
      expect(html).toContain('"type":"candlestick"');
      // PnL bubble trace name embeds trade count
      expect(html).toMatch(/"name":"Trades \(\d+\)"/);
    });

    it('synchronizes panels via xaxis matches and unified hovermode', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"hovermode":"x unified"');
      expect(html).toContain('"matches":"x"');
    });

    it('plotVolume:false drops the volume panel and Y axis', () => {
      const plotting = new Plotting(stats, { openBrowser: false, plotVolume: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).not.toContain('"name":"Volume"');
      expect(html).toContain('"yaxis3"');
      expect(html).not.toContain('"yaxis4"');
    });

    it('plotEquity:false drops the equity panel (and its annotations)', () => {
      const plotting = new Plotting(stats, { openBrowser: false, plotEquity: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).not.toContain('"name":"Equity"');
      expect(html).not.toMatch(/"name":"Peak \(/);
      expect(html).not.toMatch(/"name":"Final \(/);
    });

    it('plotTrades:false drops the PnL panel (price-panel trade segments still render)', () => {
      const plotting = new Plotting(stats, { openBrowser: false, plotTrades: false });
      plotting.plot();
      const html = lastRawHtml();
      // PnL bubble panel is gone (no `Trade PnL` trace, no PnL Y-axis with %)
      expect(html).not.toContain('"name":"Trade PnL"');
      // Trade segments on the price panel still render — they're tied to plotPrice, not plotTrades
      expect(html).toMatch(/"name":"Trades \(\d+\)"/);
      // Equity annotations on a still-rendered Equity panel are unaffected
      expect(html).toMatch(/"name":"Peak \(/);
    });

    it('emits a single Trades (N) legend entry for entry-to-exit segments on the price panel', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Single `Trades (N)` legend label (matches backtesting.py's single multi_line + factor_cmap).
      // Internally we still emit two color traces (wins + losses) but they share legendgroup so
      // only the first one carries `showlegend: true`.
      expect(html).toMatch(/"name":"Trades \(\d+\)"/);
      const idx = html.search(/"name":"Trades \(\d+\)"/);
      const segment = html.slice(idx, idx + 400);
      // Bind to price panel (yaxis3 in default Equity → PnL → Price → Volume order)
      expect(segment).toContain('"yaxis":"y3"');
      // Dotted, thick line styling
      expect(segment).toContain('"dash":"dot"');
      expect(segment).toContain('"width":6');
      // Legend group ties the two color traces together
      expect(html).toContain('"legendgroup":"trades"');
    });

    it('places overlay indicators on the price panel y-axis', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"name":"lineA"');
      expect(html).toContain('"name":"lineB"');
      const idx = html.indexOf('"name":"lineA"');
      const segment = html.slice(idx, idx + 400);
      // Price panel is yaxis3 in the new layout (Equity, PnL, Price, ...)
      expect(segment).toContain('"yaxis":"y3"');
    });

    it('overlay:false on an indicator creates an additional subplot between price and volume', async () => {
      class WithSubplot extends SmaCross {
        init(): void {
          super.init();
          this.addIndicator('lineB_subplot', this.getIndicator('lineB') as number[], { overlay: false });
        }
      }
      const bt = new Backtest(fixture, WithSubplot, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // 4 default panels + 1 subplot indicator = 5 Y-axis groups
      expect(html).toContain('"yaxis5"');
      expect(html).not.toContain('"yaxis6"');
      const idx = html.indexOf('"name":"lineB_subplot"');
      expect(idx).toBeGreaterThan(0);
      // Subplot indicator should NOT be on the price panel's y3
      const segment = html.slice(idx, idx + 400);
      expect(segment).toMatch(/"yaxis":"y4"/);
    });

    it('uses the indicator color option in the line trace', async () => {
      class Colored extends SmaCross {
        init(): void {
          this.addIndicator('priceLine', this.data['close'], { color: '#ff00ff' });
        }
        next(): void { /* no-op */ }
      }
      const bt = new Backtest(fixture, Colored, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"#ff00ff"');
    });

    it('emits Equity panel annotations: Peak / Final / Max Drawdown / Max Dd Duration', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toMatch(/"name":"Peak \([0-9.]+%\)"/);
      expect(html).toMatch(/"name":"Final \([0-9.\-]+%\)"/);
      expect(html).toMatch(/"name":"Max Drawdown \(-[0-9.]+%\)"/);
      expect(html).toMatch(/"name":"Max Dd Dur\. \(\d+ days\)"/);
      // All annotations bind to the equity panel y axis
      const peakIdx = html.search(/"name":"Peak \(/);
      const segment = html.slice(peakIdx, peakIdx + 300);
      expect(segment).toContain('"yaxis":"y"');
      // Marker size aligned with backtesting.py (8 px):
      expect(segment).toContain('"size":8');
    });

    it('renders the high-watermark drawdown fill on the equity panel', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Hidden running-max trace + equity trace with `fill: tonexty`:
      expect(html).toContain('"name":"high-watermark"');
      expect(html).toContain('"fill":"tonexty"');
      // Light-yellow fill color (matches backtesting.py's #ffffea):
      expect(html).toContain('"fillcolor":"rgba(255,255,234,0.6)"');
    });

    it('defaults to relativeEquity (percent gain mode), matching backtesting.py', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Panel title carries the [%] suffix in default (relative) mode
      expect(html).toContain('"text":"Equity [%]"');
      // Equity panel Y axis has ticksuffix '%'
      const yaxisIdx = html.indexOf('"yaxis":{');
      const yAxisSlice = html.slice(yaxisIdx, yaxisIdx + 400);
      expect(yAxisSlice).toContain('"ticksuffix":"%"');
    });

    it('relativeEquity:false switches the equity panel back to raw $', () => {
      const plotting = new Plotting(stats, { openBrowser: false, relativeEquity: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"text":"Equity"');
      expect(html).not.toContain('"text":"Equity [%]"');
      // Equity panel Y axis NOT marked with %
      const yaxisIdx = html.indexOf('"yaxis":{');
      const yAxisSlice = html.slice(yaxisIdx, yaxisIdx + 400);
      expect(yAxisSlice).not.toContain('"ticksuffix":"%"');
      // Final marker y value should be on the dollar scale, not percent
      const finalIdx = html.search(/"name":"Final \(/);
      const window = html.slice(Math.max(0, finalIdx - 200), finalIdx);
      const yMatch = window.match(/"y":\[([0-9.\-]+)\]/);
      if (!yMatch) throw new Error('expected y match');
      expect(Number(yMatch[1])).toBeGreaterThan(1000); // ~1,000,000 magnitude
    });

    it('PnL panel Y axis carries % tick suffix', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // yaxis2 corresponds to PnL panel
      const idx = html.indexOf('"yaxis2"');
      const slice = html.slice(idx, idx + 400);
      expect(slice).toContain('"ticksuffix":"%"');
    });

    it('X axes use %b %Y date tickformat', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"tickformat":"%b %Y"');
    });

    it('crosshair spike line is styled (color, thickness, dash) on every X axis', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"spikecolor":"#888"');
      expect(html).toContain('"spikethickness":1');
      expect(html).toContain('"spikedash":"dot"');
    });

    it('candlestick uses green-up / red-down colors with explicit fillcolor', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Green for up days (close > open), red for down days — Western convention
      // matching backtesting.py's BULL / BEAR colors.
      expect(html).toContain('"increasing":{"line":{"color":"#26A69A","width":1},"fillcolor":"#26A69A"}');
      expect(html).toContain('"decreasing":{"line":{"color":"#EF5350","width":1},"fillcolor":"#EF5350"}');
    });

    it('layout uses light grid color and white background', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"gridcolor":"rgba(0,0,0,0.06)"');
      expect(html).toContain('"paper_bgcolor":"#ffffff"');
      expect(html).toContain('"plot_bgcolor":"#ffffff"');
    });

    it('embeds the strategy name and date range as a centered title', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // SmaCross with default n1=20, n2=60 over the 2330 fixture (2020-01-02 → 2022-12-30).
      expect(html).toMatch(/"text":"SmaCross\(n1=20,n2=60\) — 2020-01-02 to 2022-12-30"/);
      expect(html).toContain('"xanchor":"center"');
    });

    it('positions the legend in the top-left with a thin border', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"legend":{');
      expect(html).toContain('"xanchor":"left"');
      expect(html).toContain('"yanchor":"top"');
      expect(html).toContain('"bordercolor":"#333"');
    });

    it('renders a superimposed coarser-resolution OHLC overlay by default', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"name":"OHLC (coarser)"');
      // Light alpha colors (matches backtesting.py background overlay):
      expect(html).toContain('"fillcolor":"rgba(38,166,154,0.30)"');
      expect(html).toContain('"fillcolor":"rgba(239,83,80,0.30)"');
      // Coarser overlay must come BEFORE the main OHLC trace so the daily candles render on top
      const coarserIdx = html.indexOf('"name":"OHLC (coarser)"');
      const mainIdx = html.indexOf('"name":"OHLC"');
      expect(coarserIdx).toBeGreaterThan(-1);
      expect(mainIdx).toBeGreaterThan(coarserIdx);
    });

    it('plotSuperimposedOhlc:false omits the coarser overlay', () => {
      const plotting = new Plotting(stats, { openBrowser: false, plotSuperimposedOhlc: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).not.toContain('"name":"OHLC (coarser)"');
      // Main OHLC still present
      expect(html).toContain('"name":"OHLC"');
    });

    it('auto-rule picks Q for very long datasets (>= 1500 bars)', async () => {
      const synthFixture = (n: number) =>
        Array.from({ length: n }, (_, i) => {
          const d = new Date(2018, 0, i + 1).toISOString().slice(0, 10);
          return { date: d, open: 100, high: 101, low: 99, close: 100, volume: 0 };
        });
      class FlatStrategy extends SmaCross {
        init(): void { /* no indicators */ }
        next(): void { /* no trades */ }
      }
      const longBt = new Backtest(synthFixture(1800), FlatStrategy, { cash: 1000 });
      await longBt.run();
      if (!longBt.stats) throw new Error('expected stats');
      const plotting = new Plotting(longBt.stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      const xMatch = html.match(/"type":"candlestick","x":\[([^\]]+)\]/);
      if (!xMatch) throw new Error('expected coarser candlestick x');
      // 1800 days ≈ ~5 years → quarterly buckets ≈ 20
      const qCount = xMatch[1].split(',').length;
      expect(qCount).toBeLessThan(40);
      expect(qCount).toBeGreaterThan(10);
    });

    it('auto-rule picks W for short datasets and M for medium ones', async () => {
      // Build small datasets through the public surface: HistoricalData of ~50 bars (→ W)
      // and ~300 bars (→ M).
      const synthFixture = (n: number) =>
        Array.from({ length: n }, (_, i) => {
          const d = new Date(2024, 0, i + 1).toISOString().slice(0, 10);
          return { date: d, open: 100, high: 101, low: 99, close: 100, volume: 0 };
        });
      class FlatStrategy extends SmaCross {
        init(): void { /* no indicators */ }
        next(): void { /* no trades */ }
      }

      const shortBt = new Backtest(synthFixture(50), FlatStrategy, { cash: 1000 });
      await shortBt.run();
      if (!shortBt.stats) throw new Error('expected stats');
      const plottingShort = new Plotting(shortBt.stats, { openBrowser: false });
      plottingShort.plot();
      const htmlShort = lastRawHtml();
      // Weekly rule → ~7 buckets for 50 daily bars
      // The coarser candlestick is rendered first → first `"type":"candlestick"` in HTML.
      const xShort = htmlShort.match(/"type":"candlestick","x":\[([^\]]+)\]/);
      if (!xShort) throw new Error('expected coarser candlestick x');
      const wCount = xShort[1].split(',').length;
      expect(wCount).toBeLessThan(20); // weekly buckets ≪ daily count
      expect(wCount).toBeGreaterThan(3);

      // Reset minify mock between cases
      (minify as jest.Mock).mockClear();

      const medBt = new Backtest(synthFixture(300), FlatStrategy, { cash: 1000 });
      await medBt.run();
      if (!medBt.stats) throw new Error('expected stats');
      const plottingMed = new Plotting(medBt.stats, { openBrowser: false });
      plottingMed.plot();
      const htmlMed = lastRawHtml();
      const xMed = htmlMed.match(/"type":"candlestick","x":\[([^\]]+)\]/);
      if (!xMed) throw new Error('expected coarser candlestick x');
      const mCount = xMed[1].split(',').length;
      // Monthly buckets for 300 daily bars (~10 months) — far less than weekly would give (~43).
      expect(mCount).toBeLessThan(15);
      expect(mCount).toBeGreaterThan(5);
    });

    it('superimposedOhlcRule:Q forces quarterly aggregation', () => {
      const plotting = new Plotting(stats, { openBrowser: false, superimposedOhlcRule: 'Q' });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"name":"OHLC (coarser)"');
      // Coarser overlay should produce far fewer candles than the daily series.
      // Daily fixture has ~750 bars → quarterly should be ~12 buckets.
      const xMatch = html.match(/"type":"candlestick","x":\[([^\]]+)\]/);
      expect(xMatch).not.toBeNull();
      if (!xMatch) throw new Error('expected coarser candlestick x');
      const dateCount = xMatch[1].split(',').length;
      expect(dateCount).toBeGreaterThan(1);
      expect(dateCount).toBeLessThan(30);
    });

    it('frames each panel with #666666 axis lines and mirrored borders', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).toContain('"linecolor":"#666666"');
      expect(html).toContain('"mirror":true');
      expect(html).toContain('"showline":true');
    });

    it('emits per-trade PnL segments from (EntryTime, 0%) to (ExitTime, returnPct)', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Hidden segment trace, one segment per trade with null separators
      expect(html).toContain('"name":"pnl-segments"');
      const idx = html.indexOf('"name":"pnl-segments"');
      const segment = html.slice(Math.max(0, idx - 4000), idx);
      // Y array should start with 0 (entry-side baseline) and contain null separators
      expect(segment).toMatch(/"y":\[0,/);
      expect(segment).toContain('null');
      // Hidden from legend, skips hover
      const after = html.slice(idx, idx + 200);
      expect(after).toContain('"showlegend":false');
      expect(after).toContain('"hoverinfo":"skip"');
    });

    it('omits Max Drawdown marker when the strategy never drew down', async () => {
      class FlatEquity extends SmaCross {
        init(): void { /* no-op */ }
        next(): void { /* no trades → equity stays flat at starting cash */ }
      }
      const bt = new Backtest(fixture, FlatEquity, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // No drawdown ever → no Max Drawdown marker, no Max Dd Duration bar
      expect(html).not.toMatch(/"name":"Max Drawdown \(/);
      expect(html).not.toMatch(/"name":"Max Dd Dur\./);
      // Peak / Final still emit
      expect(html).toMatch(/"name":"Peak \(/);
      expect(html).toMatch(/"name":"Final \(/);
    });

    it('bubble sizes scale with |trade.size| when trades have varying sizes', async () => {
      class VariedSizes extends SmaCross {
        next(ctx: import('../src').Context): void {
          if (ctx.index === 50) this.buy({ size: 100 });
          if (ctx.index === 100) this.sell({ size: 100 });
          if (ctx.index === 150) this.buy({ size: 500 });
          if (ctx.index === 200) this.sell({ size: 500 });
          if (ctx.index === 250) this.buy({ size: 1000 });
          if (ctx.index === 300) this.sell({ size: 1000 });
        }
      }
      const bt = new Backtest(fixture, VariedSizes, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      // Verify the bubble trace exists with a marker.size array of distinct values.
      // Locate the bubble trace ('Trade PnL' is its hidden-from-legend name).
      const tradesIdx = html.indexOf('"name":"Trade PnL"');
      expect(tradesIdx).toBeGreaterThan(-1);
      const window = html.slice(Math.max(0, tradesIdx - 4000), tradesIdx);
      const sizeMatch = window.match(/"size":\[([0-9.,\s-]+)\]/);
      if (!sizeMatch) throw new Error('expected size match');
      const sizes = sizeMatch[1].split(',').map(s => Number(s.trim()));
      expect(new Set(sizes).size).toBeGreaterThan(1);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(6);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(28);
    });

    it('omits PnL traces when there are zero closed trades', async () => {
      class NoTrades extends SmaCross {
        init(): void { /* no-op */ }
        next(): void { /* no buy/sell */ }
      }
      const bt = new Backtest(fixture, NoTrades, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).not.toMatch(/"name":"Trades \(\d+\)"/);
      // PnL panel itself still has a Y axis (we don't strip it on empty), but no trace data:
      expect(html).toContain('"yaxis2"');
    });
  });

  describe('.plotHeatmap()', () => {
    const grid: ParamHeatmap = {
      xLabel: 'n1',
      yLabel: 'n2',
      xValues: [5, 10, 20],
      yValues: [60, 120],
      z: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      metric: 'Sharpe Ratio',
    };

    it('writes a separate self-contained heatmap HTML', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plotHeatmap(grid);
      expect(minify).toHaveBeenCalled();
      const html = lastRawHtml();
      expect(html).toContain('cdn.plot.ly/plotly-2.35.2.min.js');
      expect(html).toContain('"type":"heatmap"');
      expect(html).toContain('"Sharpe Ratio"');
      expect(html).toContain('plot_heatmap');
    });

    it('embeds the supplied axis labels and z payload', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plotHeatmap(grid);
      const html = lastRawHtml();
      expect(html).toContain('"text":"n1"');
      expect(html).toContain('"text":"n2"');
      expect(html).toContain('"z":[[1,2,3],[4,5,6]]');
    });

    it('respects the filename option', () => {
      const plotting = new Plotting(stats, { openBrowser: false });
      plotting.plotHeatmap(grid, { filename: 'custom-heatmap.html', openBrowser: false });
      const fs = jest.requireMock('fs') as { writeFileSync: jest.Mock };
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.writeFileSync.mock.calls[0][0]).toBe('./custom-heatmap.html');
    });

    it('opens the heatmap HTML when openBrowser is true', () => {
      const plotting = new Plotting(stats, { openBrowser: true });
      plotting.plotHeatmap(grid);
      expect(open).toHaveBeenCalledWith('./optimize-heatmap.html');
    });
  });

  describe('multi-line / object-shaped indicators', () => {
    it('skips Record-typed indicators silently', async () => {
      class WithObjectIndicator extends SmaCross {
        init(): void {
          super.init();
          const objSeries = this.data.close.map(v => ({ upper: v + 1, lower: v - 1 }));
          this.addIndicator('bands', objSeries);
        }
      }
      const bt = new Backtest(fixture, WithObjectIndicator, { cash: 1000000 });
      const s = await bt.run();
      const plotting = new Plotting(s, { openBrowser: false });
      plotting.plot();
      const html = lastRawHtml();
      expect(html).not.toContain('"name":"bands"');
      expect(html).toContain('"name":"lineA"');
    });
  });
});
