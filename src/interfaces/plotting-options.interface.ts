export interface PlottingOptions {
  openBrowser?: boolean;
  filename?: string;
  /** Render the equity curve panel (with Peak/Final/MaxDD/MaxDdDuration annotations). Default `true`. */
  plotEquity?: boolean;
  /** Render the per-trade PnL bubble panel. Default `true`. */
  plotTrades?: boolean;
  /** Render the price candlestick + indicator overlay + trade segments panel. Default `true`. */
  plotPrice?: boolean;
  /** Render the volume bar panel. Default `true`. */
  plotVolume?: boolean;
  /**
   * Display the equity panel as percentage gain/loss from the starting equity instead of
   * absolute dollars. Default `true` (matches backtesting.py); set `false` for raw $ scale.
   */
  relativeEquity?: boolean;
  /**
   * Render a coarser-resolution OHLC overlay (weekly or monthly aggregated candles) behind
   * the daily candlesticks, drawn with light alpha to act as a subtle background. Default `true`.
   */
  plotSuperimposedOhlc?: boolean;
  /**
   * Aggregation rule for the superimposed OHLC overlay. Default `'auto'` — picks `'W'` for
   * shorter datasets (< 90 bars) and `'M'` otherwise.
   */
  superimposedOhlcRule?: 'auto' | 'W' | 'M' | 'Q';
}
