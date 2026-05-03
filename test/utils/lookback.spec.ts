import { lookback, barsSince } from '../../src/utils/lookback';

describe('utils/lookback', () => {
  describe('lookback', () => {
    it('returns the previous bar value for n=1', () => {
      expect(lookback([10, 20, 30], 2, 1)).toBe(20);
    });

    it('returns the current value for n=0', () => {
      expect(lookback([10, 20, 30], 1, 0)).toBe(20);
    });

    it('returns undefined when target index is negative', () => {
      expect(lookback([10, 20], 0, 1)).toBeUndefined();
    });

    it('returns undefined when target index exceeds bounds', () => {
      expect(lookback([10, 20], 5, 0)).toBeUndefined();
    });

    it('throws RangeError for negative n', () => {
      expect(() => lookback([10, 20], 1, -1)).toThrow(RangeError);
    });

    it('preserves generic typing for string arrays', () => {
      expect(lookback(['a', 'b', 'c'], 2, 2)).toBe('a');
    });

    it('preserves generic typing for object arrays', () => {
      const arr = [{ x: 1 }, { x: 2 }];
      expect(lookback(arr, 1, 1)).toBe(arr[0]);
    });
  });

  describe('barsSince', () => {
    it('returns 0 when condition is true at i', () => {
      expect(barsSince([false, true, false], 1)).toBe(0);
    });

    it('counts bars since the most recent true', () => {
      expect(barsSince([false, true, false, false], 3)).toBe(2);
    });

    it('returns Infinity when no true exists in [0..i]', () => {
      expect(barsSince([false, false, false], 2)).toBe(Infinity);
    });

    it('returns Infinity for empty arrays', () => {
      expect(barsSince([], 0)).toBe(Infinity);
    });

    it('ignores future trues beyond i', () => {
      expect(barsSince([false, false, true], 1)).toBe(Infinity);
    });

    it('returns Infinity for out-of-range i', () => {
      expect(barsSince([true, false], 5)).toBe(Infinity);
      expect(barsSince([true, false], -1)).toBe(Infinity);
    });
  });
});
