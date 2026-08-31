import { describe, expect, it } from "vitest";
import {
  buildTemporarySemanticLayout,
  semanticFilterCardSize,
} from "../../src/features/semantic-filter-canvas/temporaryLayout";

const item = (id: string, width = 480, height = 420) => ({ id, width, height });

describe("temporary semantic filter layout", () => {
  it("preserves surviving positions and forgets removed results", () => {
    const previous = new Map([
      ["unit-a", { x: 420, y: 260 }],
      ["unit-removed", { x: 900, y: 480 }],
    ]);
    const layout = buildTemporarySemanticLayout(
      [item("unit-a", 920, 620), item("unit-new", 560, 440)],
      previous,
      1200,
    );

    expect(layout.get("unit-a")).toEqual({ x: 420, y: 260 });
    expect(layout.has("unit-removed")).toBe(false);
    expect(layout.get("unit-new")).toBeDefined();
  });

  it("creates a non-overlapping initial grid", () => {
    const items = [item("a", 800, 520), item("b", 540, 760), item("c", 1100, 430)];
    const layout = buildTemporarySemanticLayout(items, new Map(), 1280);
    const rectangles = items.map((entry) => ({ ...entry, ...layout.get(entry.id)! }));
    for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
        const left = rectangles[leftIndex];
        const right = rectangles[rightIndex];
        expect(
          left.x + left.width <= right.x ||
          right.x + right.width <= left.x ||
          left.y + left.height <= right.y ||
          right.y + right.height <= left.y,
        ).toBe(true);
      }
    }
  });

  it("uses original semantic bounds for large previews while keeping small units readable", () => {
    expect(semanticFilterCardSize({ x: 0, y: 0, width: 960.2, height: 540.1 }))
      .toEqual({ width: 1025, height: 661 });
    expect(semanticFilterCardSize({ x: 0, y: 0, width: 120, height: 80 }))
      .toEqual({ width: 480, height: 420 });
  });
});
