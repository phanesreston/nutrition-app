/**
 * Shared between the server page that prepares the data and the client chart.
 * Kept out of the "use client" module: values exported from a client module
 * are opaque references on the server, not usable numbers.
 */
export const COVERAGE_AXIS_MAX = 200;

export interface CoverageDatum {
  name: string;
  /** Percent of target, uncapped. */
  percent: number;
  /** Percent capped to the axis maximum, used for the bar length. */
  shown: number;
  detail: string;
}
