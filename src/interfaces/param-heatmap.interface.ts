export interface ParamHeatmap {
  /** Parameter name plotted on the X axis. */
  xLabel: string;
  /** Parameter name plotted on the Y axis. */
  yLabel: string;
  /** Sorted unique values for the X parameter. */
  xValues: number[];
  /** Sorted unique values for the Y parameter. */
  yValues: number[];
  /** `z[i][j]` = score for `{ [xLabel]: xValues[j], [yLabel]: yValues[i], ...rest }`. */
  z: number[][];
  /** Axis-title-friendly label for the maximized metric. */
  metric: string;
}
