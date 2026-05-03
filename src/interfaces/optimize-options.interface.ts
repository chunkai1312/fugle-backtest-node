import { StatsIndex } from '../enums';
import { StatsResults } from '../stats';

export interface OptimizeOptions {
  /** Parameter grid: each key maps to the candidate values for that parameter. */
  params: Record<string, number[]>;
  /** Filter combinations; only those returning `true` are executed. */
  constraint?: (params: Record<string, number>) => boolean;
  /**
   * Cap the number of combinations executed. If the cartesian expansion exceeds
   * `maxTries`, a uniform-random sample of size `maxTries` is drawn (without replacement).
   * Required when `method === 'random'`.
   */
  maxTries?: number;
  /** Stats key (or scoring function) used to rank combinations. Default `EquityFinal`. */
  maximize?: StatsIndex | ((stats: StatsResults) => number);
  /**
   * Deprecated. Use `maximize` instead. Supplying both `max` and `maximize` throws TypeError.
   * @deprecated
   */
  max?: StatsIndex;
  /** `'grid'` (default) runs every combination unless capped by `maxTries`; `'random'` always samples. */
  method?: 'grid' | 'random';
  /** PRNG seed for deterministic random sampling. Defaults to `Date.now()`. */
  seed?: number;
  /** When `true`, the result includes a 2D `heatmap` of the first two `params` keys. */
  returnHeatmap?: boolean;
  /** When `true`, the result includes `all` — every executed combination's params, score, and stats. */
  returnAll?: boolean;
}
