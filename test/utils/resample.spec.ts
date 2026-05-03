import { resampleApply, bucketKey } from '../../src/utils/resample';

describe('utils/resample', () => {
  describe('bucketKey', () => {
    it('returns ISO weekYear-weekNumber for rule W', () => {
      expect(bucketKey('2023-01-04', 'W')).toBe('2023-W1');
    });

    it('places 2024-12-30 into ISO week 2025-W1 (calendar boundary)', () => {
      expect(bucketKey('2024-12-30', 'W')).toBe('2025-W1');
    });

    it('returns year-month for rule M', () => {
      expect(bucketKey('2023-03-15', 'M')).toBe('2023-3');
    });

    it('returns year-Qn for rule Q', () => {
      expect(bucketKey('2023-04-01', 'Q')).toBe('2023-Q2');
      expect(bucketKey('2023-12-31', 'Q')).toBe('2023-Q4');
    });

    it('returns year for rule Y', () => {
      expect(bucketKey('2023-07-01', 'Y')).toBe('2023');
    });
  });

  describe('resampleApply', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    it('aggregates weekly mean and broadcasts to daily index', () => {
      // 2023-01-02 (Mon) .. 2023-01-04 (Wed) are ISO week 2023-W1
      // 2023-01-09 (Mon), 2023-01-10 (Tue) are ISO week 2023-W2
      const dates = ['2023-01-02', '2023-01-03', '2023-01-04', '2023-01-09', '2023-01-10'];
      const values = [10, 20, 30, 40, 60];
      expect(resampleApply(dates, values, 'W', mean)).toEqual([20, 20, 20, 50, 50]);
    });

    it('aggregates monthly sum', () => {
      const dates = ['2023-01-15', '2023-01-31', '2023-02-01', '2023-02-15'];
      const values = [10, 20, 100, 200];
      expect(resampleApply(dates, values, 'M', sum)).toEqual([30, 30, 300, 300]);
    });

    it('aggregates quarterly max', () => {
      const dates = ['2023-01-15', '2023-03-31', '2023-04-01', '2023-06-30'];
      const values = [10, 50, 5, 80];
      const max = (xs: number[]) => Math.max(...xs);
      expect(resampleApply(dates, values, 'Q', max)).toEqual([50, 50, 80, 80]);
    });

    it('handles ISO week boundary across year', () => {
      // 2024-12-30 is ISO week 2025-W1; 2025-01-02 is also 2025-W1
      const dates = ['2024-12-30', '2025-01-02'];
      const values = [10, 30];
      expect(resampleApply(dates, values, 'W', mean)).toEqual([20, 20]);
    });

    it('throws TypeError when dates and values lengths differ', () => {
      expect(() => resampleApply(['2023-01-01'], [1, 2], 'W', mean)).toThrow(TypeError);
    });

    it('returns [] for empty input', () => {
      expect(resampleApply([], [], 'W', mean)).toEqual([]);
    });
  });
});
