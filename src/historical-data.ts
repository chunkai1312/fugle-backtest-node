import { Candle, CandleList, HistoricalDataInput } from './interfaces';

const REQUIRED_COLUMNS = ['date', 'open', 'high', 'low', 'close'] as const;

export class HistoricalData {
  readonly date: string[];
  readonly open: number[];
  readonly high: number[];
  readonly low: number[];
  readonly close: number[];
  readonly volume: number[];

  constructor(input: HistoricalDataInput) {
    const { date, open, high, low, close, volume } = HistoricalData.normalize(input);
    this.date = date;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }

  get length(): number {
    return this.date.length;
  }

  private static normalize(input: HistoricalDataInput): CandleList & { volume: number[] } {
    if (Array.isArray(input)) {
      if (input.length === 0) {
        throw new TypeError('The `data` is empty');
      }
      return HistoricalData.fromRows(input);
    }
    return HistoricalData.fromColumns(input);
  }

  private static fromRows(rows: Candle[]): CandleList & { volume: number[] } {
    const first = rows[0];
    for (const col of REQUIRED_COLUMNS) {
      if (!(col in first)) {
        throw new TypeError(
          'The `data` must contain `date`, `open`, `high`, `low`, `close`, and `volume` (optional)',
        );
      }
    }

    const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const n = sorted.length;
    const date = new Array<string>(n);
    const open = new Array<number>(n);
    const high = new Array<number>(n);
    const low = new Array<number>(n);
    const close = new Array<number>(n);
    const volume = new Array<number>(n);

    for (let i = 0; i < n; i++) {
      const row = sorted[i];
      date[i] = row.date;
      open[i] = row.open;
      high[i] = row.high;
      low[i] = row.low;
      close[i] = row.close;
      volume[i] = row.volume ?? NaN;
    }

    return { date, open, high, low, close, volume };
  }

  private static fromColumns(cols: CandleList): CandleList & { volume: number[] } {
    for (const col of REQUIRED_COLUMNS) {
      if (!Array.isArray((cols as unknown as Record<string, unknown>)[col])) {
        throw new TypeError(
          'The `data` must contain `date`, `open`, `high`, `low`, `close`, and `volume` (optional)',
        );
      }
    }

    const n = cols.date.length;
    if (n === 0) {
      throw new TypeError('The `data` is empty');
    }
    if (cols.open.length !== n || cols.high.length !== n || cols.low.length !== n || cols.close.length !== n) {
      throw new TypeError('All `data` columns must have the same length');
    }
    const volume = cols.volume ?? new Array<number>(n).fill(NaN);
    if (volume.length !== n) {
      throw new TypeError('All `data` columns must have the same length');
    }

    const indices = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
      cols.date[a] < cols.date[b] ? -1 : cols.date[a] > cols.date[b] ? 1 : 0,
    );

    const pick = <T>(src: T[]): T[] => indices.map(i => src[i]);

    return {
      date: pick(cols.date),
      open: pick(cols.open),
      high: pick(cols.high),
      low: pick(cols.low),
      close: pick(cols.close),
      volume: pick(volume),
    };
  }
}
