import { describe, expect, it } from "vitest";
import {
  isCurrentViewLoad,
  isStableViewForFile,
} from "../src/view/view-load-identity";

describe("view load identity guards", () => {
  it("rejects stale work after a leaf switches files or starts a newer load", () => {
    const firstFile = { path: "first.md" };
    const secondFile = { path: "second.md" };

    expect(isCurrentViewLoad(firstFile, firstFile, 1, 1)).toBe(true);
    expect(isCurrentViewLoad(secondFile, firstFile, 1, 1)).toBe(false);
    expect(isCurrentViewLoad(firstFile, firstFile, 2, 1)).toBe(false);
  });

  it("only allows saving when view, load generation, and parsed data agree", () => {
    const file = { path: "canvas.md" };
    const otherFile = { path: "other.md" };

    expect(isStableViewForFile(file, file, 3, 3, file, file)).toBe(true);
    expect(isStableViewForFile(file, file, 4, 3, file, file)).toBe(false);
    expect(isStableViewForFile(otherFile, file, 3, 3, file, file)).toBe(false);
    expect(isStableViewForFile(file, file, 3, 3, otherFile, file)).toBe(false);
    expect(isStableViewForFile(file, file, 3, 3, file, otherFile)).toBe(false);
  });
});
