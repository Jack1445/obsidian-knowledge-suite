import { describe, expect, it } from "vitest";
import { selectSemanticFilterUnits } from "../../src/features/semantic-filter-canvas/filterQuery";
import type {
  DocumentFieldDefinition,
  DocumentFilterDefinition,
} from "../../src/features/document-metadata/types";
import type { SemanticUnitDefinition } from "../../src/features/semantic-units/types";

const field: DocumentFieldDefinition = {
  id: "field-year",
  key: "year",
  name: "年份",
  type: "number",
  options: [],
  defaultInDocument: false,
  visibleInDocument: true,
  visibleInManager: true,
  archived: false,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

const unit = (
  id: string,
  documentPath: string | null,
  properties: SemanticUnitDefinition["properties"] = {},
): SemanticUnitDefinition => ({
  id,
  name: id,
  kind: documentPath ? "document-backed" : "free",
  documentPath,
  tags: [],
  properties,
  owner: null,
  revision: 1,
  content: { bounds: { x: 0, y: 0, width: 100, height: 80 }, members: [], assets: {} },
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
});

describe("semantic filter query", () => {
  it("matches only metadata from bound Markdown files", () => {
    const filter: DocumentFilterDefinition = {
      match: "all",
      conditions: [{ fieldId: field.id, operator: "equals", value: 2026 }],
    };
    const documents = new Map([
      ["Notes/A.md", { path: "Notes/A.md", values: { year: 2026 } }],
      ["Notes/B.md", { path: "Notes/B.md", values: { year: 2025 } }],
    ]);
    const matches = selectSemanticFilterUnits([
      unit("bound-match", "Notes/A.md"),
      unit("bound-miss", "Notes/B.md"),
      unit("broken-binding", "Notes/Missing.md"),
      unit("free-with-own-property", null, { year: 2026 }),
    ], documents, [field], filter);

    expect(matches.map((match) => match.unit.id)).toEqual(["bound-match"]);
  });

  it("shows every valid Markdown-backed unit when no conditions are active", () => {
    const documents = new Map([
      ["Notes/A.md", { path: "Notes/A.md", values: {} }],
      ["Notes/B.md", { path: "Notes/B.md", values: { year: 2025 } }],
    ]);
    const matches = selectSemanticFilterUnits([
      unit("z-unit", "Notes/B.md"),
      unit("a-unit", "Notes/A.md"),
      unit("free", null),
    ], documents, [field], { match: "all", conditions: [] });

    expect(matches.map((match) => match.unit.id)).toEqual(["a-unit", "z-unit"]);
  });
});
