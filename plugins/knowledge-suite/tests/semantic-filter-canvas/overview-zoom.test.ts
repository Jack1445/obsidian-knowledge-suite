import { describe, expect, it } from "vitest";
import {
  OVERVIEW_MIN_ZOOM,
  clampOverviewZoom,
} from "../../src/core/overviewZoom";

describe("2D overview zoom", () => {
  it("allows zooming out to five percent", () => {
    expect(OVERVIEW_MIN_ZOOM).toBe(0.05);
    expect(clampOverviewZoom(0.08, 1.8)).toBe(0.08);
    expect(clampOverviewZoom(0.01, 1.8)).toBe(0.05);
  });

  it("still respects each surface's maximum zoom", () => {
    expect(clampOverviewZoom(2.4, 1.8)).toBe(1.8);
  });
});
