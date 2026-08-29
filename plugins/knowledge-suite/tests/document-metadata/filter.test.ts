import { describe, expect, it } from "vitest";
import {
  matchesDocumentFilter,
  matchesDocumentFilterCondition,
} from "../../src/features/document-metadata/filter";
import type { DocumentFieldDefinition } from "../../src/features/document-metadata/types";

const fields: DocumentFieldDefinition[] = [
  {
    id: "status-id",
    key: "status",
    name: "发表状态",
    type: "single-select",
    options: ["阅读中", "已发表"],
    defaultInDocument: false,
    visibleInDocument: true,
    visibleInManager: true,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "date-id",
    key: "published-date",
    name: "发表日期",
    type: "date",
    options: [],
    defaultInDocument: false,
    visibleInDocument: true,
    visibleInManager: true,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "tags-id",
    key: "tags",
    name: "标签",
    type: "tags",
    options: [],
    defaultInDocument: false,
    visibleInDocument: true,
    visibleInManager: true,
    archived: false,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
];

describe("document metadata filters", () => {
  it("matches select values", () => {
    expect(matchesDocumentFilterCondition(
      { status: "已发表" },
      fields,
      { fieldId: "status-id", operator: "equals", value: "已发表" },
    )).toBe(true);
  });

  it("matches tags case-insensitively", () => {
    expect(matchesDocumentFilterCondition(
      { tags: ["VLA", "触觉"] },
      fields,
      { fieldId: "tags-id", operator: "contains", value: "vla" },
    )).toBe(true);
  });

  it("supports all and any groups", () => {
    const values = { status: "已发表", tags: ["VLA"] };
    expect(matchesDocumentFilter(values, fields, {
      match: "all",
      conditions: [
        { fieldId: "status-id", operator: "equals", value: "已发表" },
        { fieldId: "tags-id", operator: "contains", value: "VLA" },
      ],
    })).toBe(true);
    expect(matchesDocumentFilter(values, fields, {
      match: "any",
      conditions: [
        { fieldId: "status-id", operator: "equals", value: "未发表" },
        { fieldId: "tags-id", operator: "contains", value: "VLA" },
      ],
    })).toBe(true);
  });

  it("compares ISO dates chronologically", () => {
    expect(matchesDocumentFilterCondition(
      { "published-date": "2025-03-01" },
      fields,
      { fieldId: "date-id", operator: "greater-than", value: "2024-12-31" },
    )).toBe(true);
  });
});
