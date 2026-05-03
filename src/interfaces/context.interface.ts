export interface ContextBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Context {
  index: number;
  data: ContextBar;
  indicators: Map<string, number | Record<string, number>>;
  signals: Map<string, boolean>;
  prev?: Context;
}
