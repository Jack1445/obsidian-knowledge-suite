import { describe, expect, it } from "vitest";
import {
  clampDocumentColumnWidth,
  deriveDocumentFieldKey,
  hasDocumentFieldValue,
  normalizeDocumentMetadataData,
} from "../../src/features/document-metadata/schema";
import type { DocumentMetadataData } from "../../src/features/document-metadata/types";

const manager: DocumentMetadataData["manager"] = {
  search: "",
  folder: "/",
  sortFieldId: null,
  sortDirection: "asc",
  fileColumnWidth: 220,
  columnWidths: {},
};

describe("document metadata schema", () => {
  it("derives hidden stable keys from visible names", () => {
    expect(deriveDocumentFieldKey("发表 状态")).toBe("发表-状态");
    expect(deriveDocumentFieldKey(" Publication status ")).toBe("Publication-status");
  });

  it("migrates archived fields into reusable key history", () => {
    const data = normalizeDocumentMetadataData({
      schemaVersion: 1,
      fields: [{
        id: "field-year",
        key: "Year",
        name: "年份",
        type: "number",
        options: [],
        defaultInDocument: false,
        visibleInDocument: true,
        visibleInManager: true,
        archived: true,
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
      }],
      manager,
      filtersByContext: {},
      deletedFieldKeys: {},
    });

    expect(data.fields).toEqual([]);
    expect(data.deletedFieldKeys).toEqual({ "年份": "Year" });
  });

  it("recognizes only meaningful values for non-default fields", () => {
    expect(hasDocumentFieldValue(undefined)).toBe(false);
    expect(hasDocumentFieldValue("")).toBe(false);
    expect(hasDocumentFieldValue([])).toBe(false);
    expect(hasDocumentFieldValue(false)).toBe(true);
    expect(hasDocumentFieldValue(0)).toBe(true);
    expect(hasDocumentFieldValue("已发表")).toBe(true);
  });

  it("clamps remembered column widths", () => {
    expect(clampDocumentColumnWidth(30)).toBe(120);
    expect(clampDocumentColumnWidth(900)).toBe(480);
    expect(clampDocumentColumnWidth(30, true)).toBe(56);
    expect(clampDocumentColumnWidth(900, true)).toBe(480);
  });
});
