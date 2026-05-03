import { mulberry32, sampleWithoutReplacement } from '../../src/utils/random';

describe('utils/random', () => {
  describe('mulberry32', () => {
    it('produces deterministic sequence for the same seed', () => {
      const a = mulberry32(42);
      const b = mulberry32(42);
      const seq = (rng: () => number, n: number) => Array.from({ length: n }, () => rng());
      expect(seq(a, 10)).toEqual(seq(b, 10));
    });

    it('produces different sequences for different seeds', () => {
      const a = mulberry32(1);
      const b = mulberry32(2);
      expect(a()).not.toBe(b());
    });

    it('returns floats in [0, 1)', () => {
      const rng = mulberry32(0);
      for (let i = 0; i < 100; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('handles seed 0 and large seeds', () => {
      expect(typeof mulberry32(0)()).toBe('number');
      expect(typeof mulberry32(2 ** 31 - 1)()).toBe('number');
    });
  });

  describe('sampleWithoutReplacement', () => {
    it('returns k distinct elements from the array', () => {
      const rng = mulberry32(123);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sample = sampleWithoutReplacement(arr, 4, rng);
      expect(sample.length).toBe(4);
      expect(new Set(sample).size).toBe(4);
      sample.forEach(v => expect(arr).toContain(v));
    });

    it('returns a shuffled full copy when k >= arr.length', () => {
      const rng = mulberry32(123);
      const arr = [1, 2, 3];
      const sample = sampleWithoutReplacement(arr, 10, rng);
      expect(sample.length).toBe(3);
      expect(sample.sort()).toEqual([1, 2, 3]);
    });

    it('returns empty array for k <= 0', () => {
      const rng = mulberry32(0);
      expect(sampleWithoutReplacement([1, 2, 3], 0, rng)).toEqual([]);
      expect(sampleWithoutReplacement([1, 2, 3], -1, rng)).toEqual([]);
    });

    it('produces the same sample for the same seed', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const a = sampleWithoutReplacement(arr, 5, mulberry32(7));
      const b = sampleWithoutReplacement(arr, 5, mulberry32(7));
      expect(a).toEqual(b);
    });
  });
});
