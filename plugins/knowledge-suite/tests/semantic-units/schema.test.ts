import { describe, expect, it } from "vitest";
import { normalizeSemanticUnitsData } from "../../src/features/semantic-units/schema";

describe("semantic unit schema", () => {
  it("creates an isolated empty namespace without mutating input", () => {
    const first = normalizeSemanticUnitsData(null);
    const second = normalizeSemanticUnitsData(null);
    first.manager.search = "changed";
    expect(second.manager.search).toBe("");
  });

  it("fails closed for unknown versions", () => {
    expect(() => normalizeSemanticUnitsData({ schemaVersion: 2 }))
      .toThrow(/停止加载/);
  });
});
