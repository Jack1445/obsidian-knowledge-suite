import { describe, expect, it } from "vitest";
import { shouldPanSemanticFilterViewport } from "../../src/features/semantic-filter-canvas/viewportPan";

describe("semantic filter viewport panning", () => {
  it("pans with the left button only over the canvas background", () => {
    expect(shouldPanSemanticFilterViewport(0, false)).toBe(true);
    expect(shouldPanSemanticFilterViewport(0, true)).toBe(false);
  });

  it("pans with the middle button over both the background and cards", () => {
    expect(shouldPanSemanticFilterViewport(1, false)).toBe(true);
    expect(shouldPanSemanticFilterViewport(1, true)).toBe(true);
  });

  it("does not treat other mouse buttons as pan gestures", () => {
    expect(shouldPanSemanticFilterViewport(2, false)).toBe(false);
  });
});
