import {
  DEFAULT_DOCUMENT_METADATA_DATA,
  type DocumentMetadataData,
} from "./types";

const cloneDefaultData = (): DocumentMetadataData =>
  JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_METADATA_DATA)) as DocumentMetadataData;

export const deriveDocumentFieldKey = (name: string): string => name
  .normalize("NFKC")
  .trim()
  .replace(/[^\p{L}\p{N}_-]+/gu, "-")
  .replace(/^-+|-+$/g, "");

export const clampDocumentColumnWidth = (width: number, isFileColumn = false): number => {
  const minimum = isFileColumn ? 56 : 120;
  const maximum = 480;
  return Math.round(Math.min(maximum, Math.max(minimum, width)));
};

export const normalizeDocumentMetadataData = (
  raw: DocumentMetadataData | null,
): DocumentMetadataData => {
  const fallback = cloneDefaultData();
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.fields)) return fallback;
  const archivedKeyHistory = Object.fromEntries(raw.fields
    .filter((field) => field?.archived && typeof field.name === "string" && typeof field.key === "string")
    .map((field) => [field.name.trim().toLocaleLowerCase(), field.key]));
  return {
    schemaVersion: 1,
    fields: raw.fields
      .filter((field) => (
        field &&
        typeof field.id === "string" &&
        typeof field.key === "string" &&
        !field.archived
      ))
      .map((field) => ({
        ...field,
        defaultInDocument: Boolean(field.defaultInDocument),
        visibleInDocument: true,
        visibleInManager: true,
        archived: false,
      })),
    manager: {
      ...fallback.manager,
      ...(raw.manager ?? {}),
      columnWidths: {
        ...fallback.manager.columnWidths,
        ...(raw.manager?.columnWidths ?? {}),
      },
    },
    filtersByContext: raw.filtersByContext ?? {},
    deletedFieldKeys: {
      ...archivedKeyHistory,
      ...(raw.deletedFieldKeys ?? {}),
    },
  };
};

export const hasDocumentFieldValue = (value: unknown): boolean => (
  value !== undefined &&
  value !== null &&
  value !== "" &&
  (!Array.isArray(value) || value.length > 0)
);
