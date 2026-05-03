import { Trade } from '../trade';

export interface OrderOptions {
  price?: number;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  slPrice?: number;
  tpPrice?: number;
  /**
   * Trailing stop distance as a fraction of price (e.g. `0.05` for 5%).
   * Mutually exclusive with `trailAmount`. Must be in `(0, 1)`.
   */
  trailPercent?: number;
  /**
   * Trailing stop distance as an absolute price-unit difference (e.g. `5.0`).
   * Mutually exclusive with `trailPercent`. Must be `> 0`.
   */
  trailAmount?: number;
  parentTrade?: Trade;
  tag?: Record<string, string>;
}
