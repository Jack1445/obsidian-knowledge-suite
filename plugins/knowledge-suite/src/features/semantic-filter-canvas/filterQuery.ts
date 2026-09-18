import { matchesDocumentFilter } from "../document-metadata/filter";
import type {
  DocumentFieldDefinition,
  DocumentFieldValues,
  DocumentFilterDefinition,
} from "../document-metadata/types";
import type { SemanticUnitDefinition } from "../semantic-units/types";

/** A read-only Markdown metadata record available to the semantic filter canvas. */
export type SemanticFilterDocumentRecord = {
  path: string;
  values: DocumentFieldValues;
};

/** A displayed unit, optionally linked to Markdown metadata. */
export type SemanticFilterMatch = {
  unit: SemanticUnitDefinition;
  documentPath: string | null;
  values: DocumentFieldValues;
};

/**
 * Joins semantic units to Markdown metadata without consulting unit-owned
 * tags, properties, or owner fields. Free units and broken bindings are
 * deliberately excluded from attribute filtering.
 */
export const selectSemanticFilterUnits = (
  units: readonly SemanticUnitDefinition[],
  documents: ReadonlyMap<string, SemanticFilterDocumentRecord>,
  fields: readonly DocumentFieldDefinition[],
  filter: DocumentFilterDefinition,
): SemanticFilterMatch[] => units
  .flatMap((unit): SemanticFilterMatch[] => {
    if (!unit.documentPath) {
      return filter.conditions.length === 0
        ? [{ unit, documentPath: null, values: {} }]
        : [];
    }
    const document = documents.get(unit.documentPath);
    if (!document || !matchesDocumentFilter(document.values, fields, filter)) return [];
    return [{ unit, documentPath: document.path, values: { ...document.values } }];
  })
  .sort((left, right) => left.unit.name.localeCompare(right.unit.name, undefined, { numeric: true }));
