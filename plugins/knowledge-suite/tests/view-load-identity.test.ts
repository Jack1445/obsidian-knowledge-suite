import { describe, expect, it } from "vitest";
import {
  isCurrentViewLoad,
  isSameFile,
  isStableViewForFile,
} from "../src/view/view-load-identity";

describe("view load identity guards", () => {
  it("treats different file objects with the same path as the same file", () => {
    expect(isSameFile({ path: "canvas.md" }, { path: "canvas.md" })).toBe(true);
    expect(isSameFile({ path: "canvas.md" }, { path: "other.md" })).toBe(false);
  });
  it("rejects stale work after a leaf switches files or starts a newer load", () => {
    const firstFile = { path: "first.md" };
    const secondFile = { path: "second.md" };

    expect(isCurrentViewLoad(firstFile, firstFile, 1, 1)).toBe(true);
    expect(isCurrentViewLoad(secondFile, firstFile, 1, 1)).toBe(false);
    expect(isCurrentViewLoad(firstFile, firstFile, 2, 1)).toBe(false);
  });

  it("only allows saving when view, load generation, and parsed data agree", () => {
    const file = { path: "canvas.md" };
    const samePathFile = { path: "canvas.md" };
    const otherFile = { path: "other.md" };

    expect(isStableViewForFile(file, file, 3, 3, file, file)).toBe(true);
    expect(isStableViewForFile(file, file, 3, 3, null, file)).toBe(true);
    expect(isStableViewForFile(
      samePathFile,
      file,
      3,
      3,
      samePathFile,
      samePathFile,
    )).toBe(true);
    expect(isStableViewForFile(file, file, 4, 3, file, file)).toBe(false);
    expect(isStableViewForFile(otherFile, file, 3, 3, file, file)).toBe(false);
    expect(isStableViewForFile(file, file, 3, 3, otherFile, file)).toBe(false);
    expect(isStableViewForFile(file, file, 3, 3, file, otherFile)).toBe(false);
  });
});
