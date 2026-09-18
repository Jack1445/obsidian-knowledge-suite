import { TFile, type App } from "obsidian";
import type { DocumentMetadataService } from "../document-metadata/DocumentMetadataService";
import type { DocumentFilterDefinition } from "../document-metadata/types";
import type { SemanticUnitStore } from "../semantic-units/SemanticUnitStore";
import {
  selectSemanticFilterUnits,
  type SemanticFilterDocumentRecord,
  type SemanticFilterMatch,
} from "./filterQuery";

export type SemanticFilterQuerySnapshot = {
  matches: SemanticFilterMatch[];
  linkedUnitCount: number;
  unboundUnitCount: number;
  unavailableBindingCount: number;
};

/**
 * Resolves only Markdown files referenced by semantic units. It performs no
 * vault-wide scan and never writes Markdown, units, instances, or canvases.
 */
export class SemanticFilterQueryService {
  constructor(
    private readonly app: App,
    private readonly metadata: DocumentMetadataService,
    private readonly semanticUnits: SemanticUnitStore,
  ) {}

  public async query(filter: DocumentFilterDefinition): Promise<SemanticFilterQuerySnapshot> {
    const units = this.semanticUnits.getUnits();
    const linkedUnits = units.filter((unit) => Boolean(unit.documentPath));
    const paths = [...new Set(linkedUnits
      .map((unit) => unit.documentPath)
      .filter((path): path is string => Boolean(path)))];
    const records = await Promise.all(paths.map(async (path) => {
      const file = this.app.vault.getFileByPath(path);
      if (!(file instanceof TFile) || !this.metadata.isManagedMarkdownFile(file)) return null;
      try {
        return {
          path,
          values: await this.metadata.getValues(file),
        } satisfies SemanticFilterDocumentRecord;
      } catch {
        return null;
      }
    }));
    const documents = new Map(records
      .filter((record): record is SemanticFilterDocumentRecord => Boolean(record))
      .map((record) => [record.path, record]));
    const availableLinkedUnits = linkedUnits.filter((unit) => (
      unit.documentPath ? documents.has(unit.documentPath) : false
    ));
    return {
      matches: selectSemanticFilterUnits(
        units,
        documents,
        this.metadata.getFields().filter((field) => !field.archived),
        filter,
      ),
      linkedUnitCount: linkedUnits.length,
      unboundUnitCount: units.length - linkedUnits.length,
      unavailableBindingCount: linkedUnits.length - availableLinkedUnits.length,
    };
  }
}
