import {
  cumMax,
  fillNa,
  sum,
  mean,
  max,
  min,
  variance,
  stddev,
  geometricMean,
} from '../../src/utils/series';

describe('utils/series', () => {
  describe('cumMax', () => {
    it('returns running maximum', () => {
      expect(cumMax([1, 3, 2, 5, 4])).toEqual([1, 3, 3, 5, 5]);
    });

    it('returns empty array for empty input', () => {
      expect(cumMax([])).toEqual([]);
    });

    it('emits NaN at NaN positions but continues running max from prior values', () => {
      const out = cumMax([1, NaN, 3, NaN, 2]);
      expect(out[0]).toBe(1);
      expect(Number.isNaN(out[1])).toBe(true);
      expect(out[2]).toBe(3);
      expect(Number.isNaN(out[3])).toBe(true);
      expect(out[4]).toBe(3);
    });

    it('handles all NaN', () => {
      const out = cumMax([NaN, NaN]);
      expect(out.every(v => Number.isNaN(v))).toBe(true);
    });
  });

  describe('fillNa', () => {
    it('replaces NaN with the given value (default 0)', () => {
      expect(fillNa([1, NaN, 3])).toEqual([1, 0, 3]);
      expect(fillNa([NaN, NaN], -1)).toEqual([-1, -1]);
    });

    it('preserves non-NaN values including zero and negatives', () => {
      expect(fillNa([0, -1, 2])).toEqual([0, -1, 2]);
    });
  });

  describe('sum / mean / max / min', () => {
    it('skip NaN values', () => {
      expect(sum([1, NaN, 2, 3])).toBe(6);
      expect(mean([1, NaN, 3])).toBe(2);
      expect(max([1, NaN, 5, 3])).toBe(5);
      expect(min([1, NaN, -2, 3])).toBe(-2);
    });

    it('return NaN for all-NaN input', () => {
      expect(Number.isNaN(mean([NaN]))).toBe(true);
      expect(Number.isNaN(max([NaN]))).toBe(true);
      expect(Number.isNaN(min([NaN]))).toBe(true);
    });

    it('return 0 sum / NaN min/max for empty input', () => {
      expect(sum([])).toBe(0);
      expect(Number.isNaN(mean([]))).toBe(true);
      expect(Number.isNaN(max([]))).toBe(true);
      expect(Number.isNaN(min([]))).toBe(true);
    });
  });

  describe('variance / stddev', () => {
    it('use sample variance (ddof=1)', () => {
      // var of [1,2,3,4] with ddof=1 is 5/3 ≈ 1.6666...
      expect(variance([1, 2, 3, 4])).toBeCloseTo(5 / 3, 12);
      expect(stddev([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3), 12);
    });

    it('skip NaN', () => {
      expect(variance([1, NaN, 2, 3, 4])).toBeCloseTo(5 / 3, 12);
    });

    it('return NaN when fewer than 2 non-NaN values', () => {
      expect(Number.isNaN(variance([1]))).toBe(true);
      expect(Number.isNaN(variance([NaN, 1]))).toBe(true);
      expect(Number.isNaN(stddev([]))).toBe(true);
    });
  });

  describe('geometricMean', () => {
    it('computes geometric mean of returns', () => {
      // returns = 0.10, 0.10 → geomean = (1.10 * 1.10)^(1/2) - 1 = 0.10
      expect(geometricMean([0.1, 0.1])).toBeCloseTo(0.1, 10);
    });

    it('treats NaN as 0% return', () => {
      // [NaN, 0.1] becomes [0, 0.1] → geomean = (1 * 1.1)^(1/2) - 1
      expect(geometricMean([NaN, 0.1])).toBeCloseTo(Math.sqrt(1.1) - 1, 10);
    });

    it('returns 0 if any return <= -1 (total loss)', () => {
      expect(geometricMean([0.1, -1])).toBe(0);
      expect(geometricMean([0.1, -1.5])).toBe(0);
    });

    it('returns NaN for empty input', () => {
      expect(Number.isNaN(geometricMean([]))).toBe(true);
    });
  });
});
