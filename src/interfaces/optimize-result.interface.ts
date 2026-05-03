import { Stats } from '../stats';
import { ParamHeatmap } from './param-heatmap.interface';

export interface OptimizeRun {
  params: Record<string, number>;
  score: number;
  stats: Stats;
}

export interface OptimizeResult {
  /** The highest-scoring `Stats` instance. */
  best: Stats;
  /** The parameter combination that produced `best`. */
  bestParams: Record<string, number>;
  /** The score (per `maximize`) of `best`. */
  bestScore: number;
  /** Present only when `returnHeatmap === true`. */
  heatmap?: ParamHeatmap;
  /** Present only when `returnAll === true`. */
  all?: OptimizeRun[];
}
