import { HistoricalData } from '../src/historical-data';

describe('HistoricalData', () => {
  const rows = [
    { date: '2023-01-03', open: 105, high: 110, low: 100, close: 108, volume: 1000 },
    { date: '2023-01-01', open: 100, high: 105, low: 95, close: 102, volume: 500 },
    { date: '2023-01-02', open: 102, high: 108, low: 101, close: 105, volume: 750 },
  ];

  describe('row input', () => {
    it('normalizes and sorts by date ascending', () => {
      const data = new HistoricalData(rows);
      expect(data.date).toEqual(['2023-01-01', '2023-01-02', '2023-01-03']);
      expect(data.open).toEqual([100, 102, 105]);
      expect(data.close).toEqual([102, 105, 108]);
      expect(data.volume).toEqual([500, 750, 1000]);
      expect(data.length).toBe(3);
    });

    it('supports both property and bracket column access (same reference)', () => {
      const data = new HistoricalData(rows);
      expect(data['close']).toBe(data.close);
      expect(data['date']).toBe(data.date);
    });

    it('fills volume with NaN when omitted in any row', () => {
      const noVol = rows.map(row => ({
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }));
      const data = new HistoricalData(noVol);
      expect(data.volume.every(v => Number.isNaN(v))).toBe(true);
      expect(data.volume.length).toBe(3);
    });

    it('throws TypeError when data is empty', () => {
      expect(() => new HistoricalData([])).toThrow(TypeError);
      expect(() => new HistoricalData([])).toThrow('The `data` is empty');
    });

    it('throws TypeError when a required column is missing', () => {
      expect(() => new HistoricalData([{ date: '2023-01-01' } as never])).toThrow(TypeError);
    });

    it('preserves relative order when two rows share a date', () => {
      const dup = [
        { date: '2023-01-02', open: 102, high: 108, low: 101, close: 105, volume: 750 },
        { date: '2023-01-02', open: 103, high: 109, low: 102, close: 106, volume: 760 },
        { date: '2023-01-01', open: 100, high: 105, low: 95, close: 102, volume: 500 },
      ];
      const data = new HistoricalData(dup);
      expect(data.date).toEqual(['2023-01-01', '2023-01-02', '2023-01-02']);
      expect(data.open).toEqual([100, 102, 103]);
    });
  });

  describe('column input', () => {
    it('normalizes and sorts by date ascending', () => {
      const data = new HistoricalData({
        date: ['2023-01-03', '2023-01-01', '2023-01-02'],
        open: [105, 100, 102],
        high: [110, 105, 108],
        low: [100, 95, 101],
        close: [108, 102, 105],
        volume: [1000, 500, 750],
      });
      expect(data.date).toEqual(['2023-01-01', '2023-01-02', '2023-01-03']);
      expect(data.close).toEqual([102, 105, 108]);
      expect(data.volume).toEqual([500, 750, 1000]);
    });

    it('fills volume with NaN when omitted', () => {
      const data = new HistoricalData({
        date: ['2023-01-01', '2023-01-02'],
        open: [100, 102],
        high: [105, 108],
        low: [95, 101],
        close: [102, 105],
      });
      expect(data.volume.every(v => Number.isNaN(v))).toBe(true);
    });

    it('throws when columns have inconsistent lengths', () => {
      expect(() =>
        new HistoricalData({
          date: ['2023-01-01', '2023-01-02'],
          open: [100],
          high: [105, 108],
          low: [95, 101],
          close: [102, 105],
        }),
      ).toThrow(TypeError);
    });

    it('throws TypeError when a required column is missing', () => {
      expect(() =>
        new HistoricalData({
          date: ['2023-01-01'],
          open: [100],
          high: [105],
          low: [95],
        } as never),
      ).toThrow(TypeError);
    });

    it('throws TypeError when data is empty', () => {
      expect(() =>
        new HistoricalData({
          date: [],
          open: [],
          high: [],
          low: [],
          close: [],
        }),
      ).toThrow(TypeError);
    });

    it('throws when supplied volume length disagrees with other columns', () => {
      expect(() =>
        new HistoricalData({
          date: ['2023-01-01', '2023-01-02'],
          open: [100, 102],
          high: [105, 108],
          low: [95, 101],
          close: [102, 105],
          volume: [500],
        }),
      ).toThrow(TypeError);
    });

    it('preserves relative order when two rows share a date', () => {
      const data = new HistoricalData({
        date: ['2023-01-02', '2023-01-02', '2023-01-01'],
        open: [102, 103, 100],
        high: [108, 109, 105],
        low: [101, 102, 95],
        close: [105, 106, 102],
        volume: [750, 760, 500],
      });
      expect(data.date).toEqual(['2023-01-01', '2023-01-02', '2023-01-02']);
      expect(data.open).toEqual([100, 102, 103]);
    });
  });
});
