import { crossover, crossunder } from '../../src/utils/cross';

describe('utils/cross', () => {
  describe('crossover', () => {
    it('returns true at the bar after a goes above b', () => {
      const a = [1, 2, 3, 2, 1];
      const b = [2, 2, 2, 2, 2];
      expect(crossover(a, b)).toEqual([false, false, true, false, false]);
    });

    it('returns false everywhere when a never crosses above b', () => {
      const a = [1, 1, 1, 1];
      const b = [2, 2, 2, 2];
      expect(crossover(a, b)).toEqual([false, false, false, false]);
    });

    it('always returns false at index 0', () => {
      const a = [5, 1];
      const b = [1, 5];
      expect(crossover(a, b)[0]).toBe(false);
    });

    it('does not trigger when a equals b at the cross bar', () => {
      // a stays equal then increases; only the bar after equality counts when curA > curB
      const a = [1, 2, 2, 3];
      const b = [2, 2, 2, 2];
      expect(crossover(a, b)).toEqual([false, false, false, true]);
    });

    it('gates on NaN at current or previous bar', () => {
      const a = [1, 2, NaN, 3];
      const b = [2, 2, 2, 2];
      const result = crossover(a, b);
      expect(result[2]).toBe(false);
      expect(result[3]).toBe(false);
    });

    it('gates on null/undefined padding (treated as missing)', () => {
      // Simulates `Strategy.addIndicator` padding with null at the warm-up bars.
      const a = [null, null, 1, 2, 3] as unknown as number[];
      const b = [null, null, 2, 2, 2] as unknown as number[];
      const result = crossover(a, b);
      // index 2 has prev=null (gated) → false even though current 1 < 2 logic is moot
      expect(result[2]).toBe(false);
      // index 3: prev=1, cur=2, prevB=2, curB=2 → 2 > 2 false → no cross
      expect(result[3]).toBe(false);
      // index 4: prev=2 cur=3, prevB=2 curB=2 → 3>2 && 2<=2 → cross
      expect(result[4]).toBe(true);
    });

    it('throws when input lengths differ', () => {
      expect(() => crossover([1, 2], [1])).toThrow(TypeError);
    });

    it('returns empty array for empty inputs', () => {
      expect(crossover([], [])).toEqual([]);
    });
  });

  describe('crossunder', () => {
    it('returns true at the bar after a goes below b', () => {
      const a = [3, 2, 1, 2, 3];
      const b = [2, 2, 2, 2, 2];
      expect(crossunder(a, b)).toEqual([false, false, true, false, false]);
    });

    it('always returns false at index 0', () => {
      const a = [1, 5];
      const b = [5, 1];
      expect(crossunder(a, b)[0]).toBe(false);
    });

    it('gates on NaN', () => {
      const a = [3, 2, NaN, 1];
      const b = [2, 2, 2, 2];
      const result = crossunder(a, b);
      expect(result[2]).toBe(false);
      expect(result[3]).toBe(false);
    });

    it('throws when input lengths differ', () => {
      expect(() => crossunder([1], [1, 2])).toThrow(TypeError);
    });
  });
});
