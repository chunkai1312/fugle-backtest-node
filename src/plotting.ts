import * as fs from 'fs';
import * as open from 'open';
import { minify } from 'html-minifier';
import { Stats, TradeLogRow, EquityCurveRow } from './stats';
import { Strategy, IndicatorOptions } from './strategy';
import { PlottingOptions, ParamHeatmap } from './interfaces';
import { EquityCurveColumn, TradeLogColumn, StatsIndex } from './enums';
import { bucketKey, ResampleRule } from './utils/resample';

const PLOTLY_CDN = 'https://cdn.plot.ly/plotly-2.35.2.min.js';

const COLOR_WIN = '#2ca02c';
const COLOR_LOSS = '#d62728';
// K-line: green = up (close > open), red = down (close < open) — Western convention,
// matches backtesting.py's BULL / BEAR colors.
const COLOR_BULL = '#26A69A'; // teal-green
const COLOR_BEAR = '#EF5350'; // salmon-red
const COLOR_PEAK = '#17becf';   // cyan
const COLOR_FINAL = '#1f77b4';  // blue
const COLOR_MAX_DD = '#d62728'; // red
const COLOR_GRID_LINE = 'rgba(160,160,160,0.5)';
const COLOR_VOLUME_GREY = '#9aa0a6';
// High-watermark drawdown fill (matches backtesting.py's `#ffffea` fill / `#ffcb66` outline).
const COLOR_HW_FILL = 'rgba(255,255,234,0.6)';
const COLOR_HW_OUTLINE = '#ffcb66';

interface PanelSpec {
  id: string;
  title: string;
  weight: number;            // relative height weight
  axisIndex: number;         // 1, 2, 3, ...
  domain: [number, number];  // [bottom, top] in 0..1
}

interface PlotlyTrace {
  type: string;
  name?: string;
  xaxis?: string;
  yaxis?: string;
  showlegend?: boolean;
  [key: string]: unknown;
}

interface PriceData {
  date: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

interface IndicatorEntry {
  name: string;
  values: number[];
  meta: Required<IndicatorOptions>;
}

export class Plotting {
  private readonly openBrowser: boolean;
  private readonly filename: string;
  private readonly options: PlottingOptions;

  constructor(private readonly stats: Stats, options?: PlottingOptions) {
    this.options = options ?? {};
    this.openBrowser = this.options.openBrowser ?? true;
    this.filename = this.options.filename ?? 'output.html';
  }

  public plot(): void {
    const html = minify(this.createHTML(), {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
      minifyJS: true,
    });
    const outputFile = `./${this.filename}`;
    fs.writeFileSync(outputFile, html);
    if (this.openBrowser) open(outputFile);
  }

  /**
   * Render a standalone heatmap of two optimization parameters against an objective metric.
   */
  public plotHeatmap(grid: ParamHeatmap, options?: { filename?: string; openBrowser?: boolean }): void {
    const filename = options?.filename ?? 'optimize-heatmap.html';
    const openInBrowser = options?.openBrowser ?? this.openBrowser;
    const html = minify(this.createHeatmapHTML(grid), {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
      minifyJS: true,
    });
    const outputFile = `./${filename}`;
    fs.writeFileSync(outputFile, html);
    if (openInBrowser) open(outputFile);
  }

  private createHTML(): string {
    const equityCurve = this.stats.equityCurve;
    const tradeLog = this.stats.tradeLog;
    const results = this.stats.results;
    /* istanbul ignore if */
    if (!results || !equityCurve || !tradeLog) {
      throw new Error('Stats not computed');
    }

    const priceData = this.collectPriceData();

    const overlayIndicators: IndicatorEntry[] = [];
    const subplotIndicators: IndicatorEntry[] = [];
    this.collectIndicators(overlayIndicators, subplotIndicators);

    const showEquity = this.options.plotEquity !== false;
    const showTrades = this.options.plotTrades !== false;
    const showPrice = this.options.plotPrice !== false;
    const showVolume = this.options.plotVolume !== false;
    const relativeEquity = this.options.relativeEquity !== false;

    // Top-to-bottom panel order: Equity → PnL → Price → [oscillator subplots] → Volume.
    const panels: PanelSpec[] = [];
    if (showEquity) panels.push({ id: 'equity', title: relativeEquity ? 'Equity [%]' : 'Equity', weight: 2.2, axisIndex: 0, domain: [0, 0] });
    if (showTrades) panels.push({ id: 'pnl', title: 'PnL [%]', weight: 2.0, axisIndex: 0, domain: [0, 0] });
    if (showPrice) panels.push({ id: 'price', title: 'Price', weight: 3.8, axisIndex: 0, domain: [0, 0] });
    if (showPrice) {
      for (const ind of subplotIndicators) {
        panels.push({ id: `ind_${ind.name}`, title: ind.name, weight: 1.0, axisIndex: 0, domain: [0, 0] });
      }
    }
    if (showVolume) panels.push({ id: 'volume', title: 'Volume', weight: 1.2, axisIndex: 0, domain: [0, 0] });

    this.assignPanelDomains(panels);

    const traces: PlotlyTrace[] = [];
    const layout = this.buildLayout(panels, {
      relativeEquity,
      strategyName: String(results[StatsIndex.Strategy]),
      startDate: String(results[StatsIndex.Start]),
      endDate: String(results[StatsIndex.End]),
    });

    if (showEquity) {
      const axes = this.axesFor(panels, 'equity');
      traces.push(...this.equityTraces(equityCurve, axes, relativeEquity));
    }

    if (showTrades) {
      const axes = this.axesFor(panels, 'pnl');
      traces.push(...this.pnlBubbleTraces(tradeLog, axes));
    }

    if (showPrice) {
      const priceAxes = this.axesFor(panels, 'price');
      // Superimposed coarser-resolution OHLC (weekly/monthly) drawn FIRST so the daily
      // candles render on top. Acts as a subtle background to highlight longer-term swings.
      if (this.options.plotSuperimposedOhlc !== false) {
        const rule = this.pickSuperimposedRule(priceData.date.length);
        const aggregated = this.aggregateOHLC(priceData, rule);
        if (aggregated.date.length > 1 && aggregated.date.length < priceData.date.length) {
          traces.push(this.superimposedCandlestickTrace(aggregated, priceAxes));
        }
      }
      traces.push(this.candlestickTrace(priceData, priceAxes));
      for (const ind of overlayIndicators) {
        traces.push(this.indicatorTrace(priceData.date, ind, priceAxes));
      }
      traces.push(...this.tradeSegmentTraces(priceData, tradeLog, priceAxes));
      for (const ind of subplotIndicators) {
        const axes = this.axesFor(panels, `ind_${ind.name}`);
        traces.push(this.indicatorTrace(priceData.date, ind, axes));
      }
    }

    if (showVolume) {
      const axes = this.axesFor(panels, 'volume');
      traces.push(this.volumeTrace(priceData, axes));
    }

    return this.renderHTML('Backtest Result', traces, layout);
  }

  private createHeatmapHTML(grid: ParamHeatmap): string {
    const trace = {
      type: 'heatmap',
      x: grid.xValues,
      y: grid.yValues,
      z: grid.z,
      colorbar: { title: grid.metric },
      colorscale: 'Viridis',
    };
    const layout = {
      title: `Optimization heatmap (${grid.metric})`,
      xaxis: { title: { text: grid.xLabel } },
      yaxis: { title: { text: grid.yLabel } },
    };
    return this.renderHTML('Optimization Heatmap', [trace as unknown as PlotlyTrace], layout, 'plot_heatmap');
  }

  private renderHTML(title: string, traces: PlotlyTrace[], layout: Record<string, unknown>, divId = 'plot'): string {
    const tracesJson = JSON.stringify(traces);
    const layoutJson = JSON.stringify(layout);
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="${PLOTLY_CDN}"></script>
          <title>${title}</title>
          <style>
            body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; }
            #${divId} { width: 100%; height: ${this.heightFor(divId)}px; }
          </style>
        </head>
        <body>
          <div id="${divId}"></div>
          <script>
            Plotly.newPlot('${divId}', JSON.parse('${tracesJson}'), JSON.parse('${layoutJson}'));
          </script>
        </body>
      </html>
    `;
  }

  private heightFor(divId: string): number {
    if (divId === 'plot_heatmap') return 600;
    return 900;
  }

  private collectPriceData(): PriceData {
    const strategy = (this.stats as unknown as { strategy: Strategy }).strategy;
    const data = strategy.data;
    return {
      date: data.date,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume,
    };
  }

  private collectIndicators(overlay: IndicatorEntry[], subplot: IndicatorEntry[]): void {
    const strategy = (this.stats as unknown as { strategy: Strategy }).strategy;
    for (const name of Object.keys(strategy.indicators)) {
      const raw = strategy.indicators[name];
      // Only flat number[] indicators are plottable; multi-line Record<string, number>[] are skipped.
      // The warm-up bars are null-padded by addIndicator, so look for the first non-null entry.
      const sample = (raw as Array<number | null | Record<string, number>>).find(v => v != null);
      if (sample === undefined || typeof sample !== 'number') continue;
      const meta = strategy.getIndicatorOptions(name);
      /* istanbul ignore next */
      if (!meta) continue;
      const entry = { name, values: raw as number[], meta };
      if (meta.overlay) overlay.push(entry);
      else subplot.push(entry);
    }
  }

  private assignPanelDomains(panels: PanelSpec[]): void {
    /* istanbul ignore if */
    if (panels.length === 0) return;
    const gap = 0.02;
    const totalGap = gap * (panels.length - 1);
    const totalWeight = panels.reduce((s, p) => s + p.weight, 0);
    const usable = 1 - totalGap;
    let cursor = 1;
    for (let i = 0; i < panels.length; i++) {
      const slice = (panels[i].weight / totalWeight) * usable;
      const top = cursor;
      const bottom = top - slice;
      panels[i].domain = [Math.max(0, bottom), top];
      panels[i].axisIndex = i + 1;
      cursor = bottom - gap;
    }
  }

  private axesFor(panels: PanelSpec[], id: string): { x: string; y: string } {
    const panel = panels.find(p => p.id === id);
    /* istanbul ignore if */
    if (!panel) throw new Error(`Plotting: panel "${id}" not in active set`);
    const idx = panel.axisIndex;
    return {
      x: idx === 1 ? 'x' : `x${idx}`,
      y: idx === 1 ? 'y' : `y${idx}`,
    };
  }

  private buildLayout(
    panels: PanelSpec[],
    opts: { relativeEquity: boolean; strategyName: string; startDate: string; endDate: string },
  ): Record<string, unknown> {
    const layout: Record<string, unknown> = {
      title: {
        text: `${opts.strategyName} — ${opts.startDate} to ${opts.endDate}`,
        font: { size: 13, color: '#444' },
        x: 0.5,
        xanchor: 'center',
        y: 0.985,
        yanchor: 'top',
      },
      hovermode: 'x unified',
      showlegend: true,
      legend: {
        x: 0,
        y: 1,
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.85)',
        bordercolor: '#333',
        borderwidth: 1,
        font: { size: 10 },
      },
      margin: { l: 60, r: 30, t: 50, b: 40 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
    };
    for (const panel of panels) {
      const idx = panel.axisIndex;
      const xKey = idx === 1 ? 'xaxis' : `xaxis${idx}`;
      const yKey = idx === 1 ? 'yaxis' : `yaxis${idx}`;
      const xAxis: Record<string, unknown> = {
        anchor: idx === 1 ? 'y' : `y${idx}`,
        showspikes: true,
        spikemode: 'across',
        spikecolor: '#888',
        spikethickness: 1,
        spikedash: 'dot',
        gridcolor: 'rgba(0,0,0,0.06)',
        gridwidth: 0.5,
        tickformat: '%b %Y',
        // Frame each panel with a subtle outline (matches backtesting.py's outline_line_color).
        showline: true,
        linecolor: '#666666',
        linewidth: 1,
        mirror: true,
      };
      if (idx > 1) xAxis.matches = 'x';
      if (idx !== panels.length) xAxis.showticklabels = false;
      if (panel.id === 'price') xAxis.rangeslider = { visible: false };
      layout[xKey] = xAxis;

      const yAxis: Record<string, unknown> = {
        anchor: idx === 1 ? 'x' : `x${idx}`,
        domain: panel.domain,
        title: { text: panel.title, standoff: 8 },
        gridcolor: 'rgba(0,0,0,0.06)',
        gridwidth: 0.5,
        zerolinecolor: 'rgba(0,0,0,0.2)',
        showline: true,
        linecolor: '#666666',
        linewidth: 1,
        mirror: true,
      };
      // PnL panel always shows percent; Equity panel shows percent only when relative.
      if (panel.id === 'pnl' || (panel.id === 'equity' && opts.relativeEquity)) {
        yAxis.ticksuffix = '%';
      }
      layout[yKey] = yAxis;
    }
    return layout;
  }

  // ─── Equity panel: line + 4 annotation markers ─────────────────────────────

  private equityTraces(
    curve: EquityCurveRow[],
    axes: { x: string; y: string },
    relativeEquity: boolean,
  ): PlotlyTrace[] {
    const dates = curve.map(r => r.date);
    const rawEquity = curve.map(r => r[EquityCurveColumn.Equity]);
    const drawdownPct = curve.map(r => r[EquityCurveColumn.DrawdownPct]);
    const ddDuration = curve.map(r => r[EquityCurveColumn.DrawdownDuration]);
    const startEquity = rawEquity[0];

    // Y values displayed on the panel — either absolute equity or % gain from start.
    const toDisplay = (v: number): number =>
      relativeEquity ? ((v - startEquity) / startEquity) * 100 : v;
    const equity = rawEquity.map(toDisplay);

    // Running max (high-watermark) for the drawdown fill.
    const cumMax = new Array<number>(equity.length);
    let runningMax = equity[0];
    for (let i = 0; i < equity.length; i++) {
      if (equity[i] > runningMax) runningMax = equity[i];
      cumMax[i] = runningMax;
    }

    const traces: PlotlyTrace[] = [];

    // High-watermark drawdown fill: render two stacked traces — the running max
    // line first, then equity with `fill: 'tonexty'`. This shades the region
    // between equity and the prior peak whenever the strategy is below water.
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: cumMax,
      line: { color: COLOR_HW_OUTLINE, width: 0.5 },
      name: 'high-watermark',
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: equity,
      name: 'Equity',
      line: { color: COLOR_FINAL, width: 1.5 },
      fill: 'tonexty',
      fillcolor: COLOR_HW_FILL,
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Peak: argmax of raw equity.
    let peakIdx = 0;
    for (let i = 1; i < rawEquity.length; i++) {
      if (rawEquity[i] > rawEquity[peakIdx]) peakIdx = i;
    }
    const peakReturnPct = ((rawEquity[peakIdx] - startEquity) / startEquity) * 100;
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: [dates[peakIdx]],
      y: [equity[peakIdx]],
      marker: { size: 8, color: COLOR_PEAK, line: { color: '#000', width: 1 } },
      name: `Peak (${peakReturnPct.toFixed(1)}%)`,
      hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Final: last bar.
    const finalIdx = rawEquity.length - 1;
    const finalReturnPct = ((rawEquity[finalIdx] - startEquity) / startEquity) * 100;
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: [dates[finalIdx]],
      y: [equity[finalIdx]],
      marker: { size: 8, color: COLOR_FINAL, line: { color: '#000', width: 1 } },
      name: `Final (${finalReturnPct.toFixed(1)}%)`,
      hovertemplate: 'Final<br>%{x}<br>%{y}<extra></extra>',
      xaxis: axes.x,
      yaxis: axes.y,
    });

    // Max Drawdown: argmax of drawdownPct.
    let maxDdIdx = 0;
    for (let i = 1; i < drawdownPct.length; i++) {
      if (drawdownPct[i] > drawdownPct[maxDdIdx]) maxDdIdx = i;
    }
    const maxDdPctValue = drawdownPct[maxDdIdx] * 100;
    if (maxDdPctValue > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: [dates[maxDdIdx]],
        y: [equity[maxDdIdx]],
        marker: { size: 8, color: COLOR_MAX_DD, line: { color: '#000', width: 1 } },
        name: `Max Drawdown (-${maxDdPctValue.toFixed(1)}%)`,
        hovertemplate: 'Max Drawdown<br>%{x}<br>%{y}<extra></extra>',
        xaxis: axes.x,
        yaxis: axes.y,
      });
    }

    // Max Dd Duration: longest drawdown stretch — find recovery index with max ddDuration,
    // then walk backwards to the prior peak (index where DrawdownPct === 0).
    let maxDurIdx = -1;
    let maxDur = 0;
    for (let i = 0; i < ddDuration.length; i++) {
      const d = ddDuration[i];
      if (!Number.isNaN(d) && d > maxDur) {
        maxDur = d;
        maxDurIdx = i;
      }
    }
    if (maxDurIdx >= 0) {
      let priorPeakIdx = maxDurIdx;
      for (let j = maxDurIdx - 1; j >= 0; j--) {
        if (drawdownPct[j] === 0) {
          priorPeakIdx = j;
          break;
        }
      }
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [dates[priorPeakIdx], dates[maxDurIdx]],
        y: [equity[priorPeakIdx], equity[priorPeakIdx]],
        line: { color: COLOR_MAX_DD, width: 2 },
        name: `Max Dd Dur. (${Math.ceil(maxDur)} days)`,
        hovertemplate: 'Max Dd Duration<br>%{x}<extra></extra>',
        xaxis: axes.x,
        yaxis: axes.y,
      });
    }

    return traces;
  }

  // ─── PnL panel: bubble plot + connecting line ──────────────────────────────

  private pnlBubbleTraces(trades: TradeLogRow[], axes: { x: string; y: string }): PlotlyTrace[] {
    if (trades.length === 0) return [];
    const xs = trades.map(t => t[TradeLogColumn.ExitTime]);
    const ys = trades.map(t => t[TradeLogColumn.ReturnPct] * 100);
    const sizes = trades.map(t => Math.abs(t[TradeLogColumn.Size]));
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    // Linear interp size to [8, 20] px (matches backtesting.py).
    const scaleSize = (s: number): number => {
      if (maxSize === minSize) return 14;
      return 8 + ((s - minSize) / (maxSize - minSize)) * 12;
    };
    const colors = trades.map(t => (t[TradeLogColumn.PnL] > 0 ? COLOR_WIN : COLOR_LOSS));

    // Per-trade diagonal segments from (EntryTime, 0%) to (ExitTime, return%).
    // The line slope encodes the holding period and per-bar pace of return,
    // anchoring every trade to the y = 0 baseline (matches backtesting.py exactly:
    // `multi_line` with xs = [entryBar, exitBar] and ys = [0, return]).
    const segX: Array<string | null> = [];
    const segY: Array<number | null> = [];
    for (const t of trades) {
      segX.push(t[TradeLogColumn.EntryTime], t[TradeLogColumn.ExitTime], null);
      segY.push(0, t[TradeLogColumn.ReturnPct] * 100, null);
    }

    return [
      {
        type: 'scatter',
        mode: 'lines',
        x: segX,
        y: segY,
        line: { color: COLOR_GRID_LINE, width: 1 },
        name: 'pnl-segments',
        showlegend: false,
        hoverinfo: 'skip',
        xaxis: axes.x,
        yaxis: axes.y,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: xs,
        y: ys,
        marker: {
          size: sizes.map(scaleSize),
          color: colors,
          line: { color: 'rgba(0,0,0,0.3)', width: 1 },
        },
        customdata: trades.map(t => [t[TradeLogColumn.Size], t[TradeLogColumn.PnL]]),
        hovertemplate:
          '%{x}<br>Return: %{y:.2f}%<br>Size: %{customdata[0]}<br>PnL: %{customdata[1]:.2f}<extra></extra>',
        // Hidden from legend — matches backtesting.py, where the bubble scatter
        // has no `legend_label`. The single `Trades (N)` legend entry lives on
        // the price-panel segments instead.
        name: 'Trade PnL',
        showlegend: false,
        xaxis: axes.x,
        yaxis: axes.y,
      },
    ];
  }

  // ─── Price panel: candlestick + indicator overlays + trade segments ────────

  private candlestickTrace(price: PriceData, axes: { x: string; y: string }): PlotlyTrace {
    return {
      type: 'candlestick',
      x: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      name: 'OHLC',
      // Western convention: green when close > open, red when close < open.
      // Explicit fillcolor + line.color so Plotly doesn't fall back to a default
      // palette when only `line` is specified.
      increasing: {
        line: { color: COLOR_BULL, width: 1 },
        fillcolor: COLOR_BULL,
      },
      decreasing: {
        line: { color: COLOR_BEAR, width: 1 },
        fillcolor: COLOR_BEAR,
      },
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  /**
   * Coarser-resolution candlestick rendered behind the daily candles. Light alpha
   * fill / outline so it acts as a subtle background highlighting longer-term swings
   * (matches backtesting.py's superimposed downsampled overlay).
   */
  private superimposedCandlestickTrace(
    price: PriceData,
    axes: { x: string; y: string },
  ): PlotlyTrace {
    return {
      type: 'candlestick',
      x: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      name: 'OHLC (coarser)',
      // Tinted enough to read as "this aggregated period was up/down" on white
      // backgrounds — backtesting.py uses HSL lightness 0.92 (~RGB-mixed alpha 0.3).
      increasing: {
        line: { color: 'rgba(38,166,154,0.55)', width: 1 },
        fillcolor: 'rgba(38,166,154,0.30)',
      },
      decreasing: {
        line: { color: 'rgba(239,83,80,0.55)', width: 1 },
        fillcolor: 'rgba(239,83,80,0.30)',
      },
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  private pickSuperimposedRule(barCount: number): ResampleRule {
    const rule = this.options.superimposedOhlcRule;
    if (rule && rule !== 'auto') return rule;
    // Auto thresholds chosen so the overlay has roughly 30–60 buckets — dense enough
    // that the coarser candles fit naturally next to the daily ones (vs being giant
    // background rectangles that overpower the foreground).
    //   < ~1 year (250 bars)     → weekly
    //   ~1–6 years (1500 bars)   → monthly
    //   ≥ ~6 years               → quarterly
    if (barCount < 250) return 'W';
    if (barCount < 1500) return 'M';
    return 'Q';
  }

  private aggregateOHLC(price: PriceData, rule: ResampleRule): PriceData {
    const indicesByBucket = new Map<string, number[]>();
    for (let i = 0; i < price.date.length; i++) {
      const key = bucketKey(price.date[i], rule);
      const list = indicesByBucket.get(key);
      if (list) list.push(i);
      else indicesByBucket.set(key, [i]);
    }
    const out: PriceData = { date: [], open: [], high: [], low: [], close: [], volume: [] };
    for (const indices of indicesByBucket.values()) {
      const first = indices[0];
      const last = indices[indices.length - 1];
      const mid = indices[Math.floor(indices.length / 2)];
      let highMax = Number.NEGATIVE_INFINITY;
      let lowMin = Number.POSITIVE_INFINITY;
      let volSum = 0;
      for (const i of indices) {
        if (price.high[i] > highMax) highMax = price.high[i];
        if (price.low[i] < lowMin) lowMin = price.low[i];
        if (Number.isFinite(price.volume[i])) volSum += price.volume[i];
      }
      out.date.push(price.date[mid]);
      out.open.push(price.open[first]);
      out.high.push(highMax);
      out.low.push(lowMin);
      out.close.push(price.close[last]);
      out.volume.push(volSum);
    }
    return out;
  }

  private indicatorTrace(dates: string[], ind: IndicatorEntry, axes: { x: string; y: string }): PlotlyTrace {
    return {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: ind.values,
      name: ind.name,
      line: ind.meta.color ? { color: ind.meta.color, width: 1.5 } : { width: 1.5 },
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  /**
   * Two traces (one per win/loss color) sharing a single `Trades (N)` legend entry
   * via Plotly's `legendgroup`. Plotly does not support per-segment line color
   * within a single trace, so this is the cleanest way to mirror backtesting.py's
   * single `multi_line` + `factor_cmap` layout.
   */
  private tradeSegmentTraces(
    price: PriceData,
    trades: TradeLogRow[],
    axes: { x: string; y: string },
  ): PlotlyTrace[] {
    if (trades.length === 0) return [];
    const wins = trades.filter(t => t[TradeLogColumn.PnL] > 0);
    const losses = trades.filter(t => t[TradeLogColumn.PnL] <= 0);
    const result: PlotlyTrace[] = [];
    const legendName = `Trades (${trades.length})`;
    // Both traces share legendgroup 'trades' so a single legend entry toggles both.
    // The first emitted trace owns the visible legend label.
    if (wins.length) {
      result.push(this.tradeSegmentTrace(price, wins, legendName, COLOR_WIN, axes, true));
    }
    if (losses.length) {
      result.push(this.tradeSegmentTrace(
        price,
        losses,
        legendName,
        COLOR_LOSS,
        axes,
        // Hide the loss trace from the legend if wins already represented the group.
        wins.length === 0,
      ));
    }
    return result;
  }

  private tradeSegmentTrace(
    price: PriceData,
    trades: TradeLogRow[],
    name: string,
    color: string,
    axes: { x: string; y: string },
    showInLegend: boolean,
  ): PlotlyTrace {
    const x: Array<string | null> = [];
    const y: Array<number | null> = [];
    for (const t of trades) {
      const entryDate = price.date[t[TradeLogColumn.EntryBar]];
      const exitBar = t[TradeLogColumn.ExitBar];
      /* istanbul ignore if */
      if (exitBar === undefined) continue;
      const exitDate = price.date[exitBar];
      const exitPrice = t[TradeLogColumn.ExitPrice];
      /* istanbul ignore if */
      if (exitPrice === undefined) continue;
      x.push(entryDate, exitDate, null);
      y.push(t[TradeLogColumn.EntryPrice], exitPrice, null);
    }
    return {
      type: 'scatter',
      mode: 'lines',
      x,
      y,
      line: { color, width: 6, dash: 'dot' },
      name,
      legendgroup: 'trades',
      showlegend: showInLegend,
      hoverinfo: 'skip',
      xaxis: axes.x,
      yaxis: axes.y,
    };
  }

  // ─── Volume panel ──────────────────────────────────────────────────────────

  private volumeTrace(price: PriceData, axes: { x: string; y: string }): PlotlyTrace {
    const colors: string[] = price.date.map((_, i) => {
      if (i === 0) return COLOR_VOLUME_GREY;
      const close = price.close[i];
      const open = price.open[i];
      if (close > open) return COLOR_WIN;
      if (close < open) return COLOR_LOSS;
      return COLOR_VOLUME_GREY;
    });
    return {
      type: 'bar',
      x: price.date,
      y: price.volume,
      name: 'Volume',
      marker: { color: colors },
      xaxis: axes.x,
      yaxis: axes.y,
      showlegend: false,
    };
  }
}
