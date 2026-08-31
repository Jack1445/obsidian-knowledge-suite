/** Shared lower bound for two-dimensional overview surfaces. */
export const OVERVIEW_MIN_ZOOM = 0.05;

export const clampOverviewZoom = (value: number, maximum: number): number => (
  Math.min(maximum, Math.max(OVERVIEW_MIN_ZOOM, value))
);
