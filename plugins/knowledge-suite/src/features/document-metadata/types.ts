/** Field types supported by the Markdown metadata manager and document panel. */
export type DocumentFieldType =
  | "text"
  | "number"
  | "date"
  | "single-select"
  | "multi-select"
  | "checkbox"
  | "tags";

export type DocumentFieldValue = string | number | boolean | string[] | null;

export type DocumentFieldValues = Record<string, DocumentFieldValue>;

export type DocumentFieldDefinition = {
  id: string;
  key: string;
  name: string;
  type: DocumentFieldType;
  options: string[];
  color?: string;
  defaultInDocument: boolean;
  visibleInDocument: boolean;
  visibleInManager: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentFilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "greater-than"
  | "less-than"
  | "is-empty"
  | "is-not-empty";

export type DocumentFilterCondition = {
  fieldId: string;
  operator: DocumentFilterOperator;
  value?: DocumentFieldValue;
};

export type DocumentFilterDefinition = {
  match: "all" | "any";
  conditions: DocumentFilterCondition[];
};

export type DocumentMetadataData = {
  schemaVersion: 1;
  fields: DocumentFieldDefinition[];
  manager: {
    search: string;
    folder: string;
    sortFieldId: string | null;
    sortDirection: "asc" | "desc";
    fileColumnWidth: number;
    columnWidths: Record<string, number>;
  };
  filtersByContext: Record<string, DocumentFilterDefinition>;
  deletedFieldKeys: Record<string, string>;
};

export type CreateDocumentFieldInput = {
  name: string;
  key?: string;
  type: DocumentFieldType;
  options?: string[];
  color?: string;
  defaultInDocument?: boolean;
};

export type UpdateDocumentFieldInput = Partial<
  Pick<
    DocumentFieldDefinition,
    "name" | "type" | "options" | "color" | "defaultInDocument" | "visibleInDocument" | "visibleInManager"
  >
>;

export const DEFAULT_DOCUMENT_METADATA_DATA: DocumentMetadataData = {
  schemaVersion: 1,
  fields: [],
  manager: {
    search: "",
    folder: "/",
    sortFieldId: null,
    sortDirection: "asc",
    fileColumnWidth: 200,
    columnWidths: {},
  },
  filtersByContext: {},
  deletedFieldKeys: {},
};

export const DOCUMENT_FIELD_TYPE_LABELS: Record<DocumentFieldType, string> = {
  text: "文本",
  number: "数字",
  date: "日期",
  "single-select": "单选",
  "multi-select": "多选",
  checkbox: "复选框",
  tags: "标签",
};
