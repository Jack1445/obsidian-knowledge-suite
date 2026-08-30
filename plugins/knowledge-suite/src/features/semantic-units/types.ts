export type SemanticUnitJsonPrimitive = string | number | boolean | null;

export type SemanticUnitJsonValue =
  | SemanticUnitJsonPrimitive
  | SemanticUnitJsonValue[]
  | { [key: string]: SemanticUnitJsonValue };

export type SemanticUnitJsonObject = {
  [key: string]: SemanticUnitJsonValue;
};

export type SemanticUnitKind = "document-backed" | "free";

export type SemanticUnitBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A canonical member uses a stable semantic ID rather than a live Excalidraw
 * element ID. Internal bindings are remapped to these IDs before persistence.
 */
export type SemanticUnitMemberSnapshot = {
  memberId: string;
  element: SemanticUnitJsonObject;
};

export type SemanticUnitAssetSnapshot = {
  mimeType: string;
  dataURL?: string;
  created?: number;
  sourcePath?: string;
};

export type SemanticUnitContentSnapshot = {
  bounds: SemanticUnitBounds;
  members: SemanticUnitMemberSnapshot[];
  assets: Record<string, SemanticUnitAssetSnapshot>;
};

export type SemanticUnitDefinition = {
  id: string;
  name: string;
  kind: SemanticUnitKind;
  documentPath: string | null;
  tags: string[];
  properties: Record<string, SemanticUnitJsonValue>;
  owner: string | null;
  revision: number;
  content: SemanticUnitContentSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type SemanticUnitInstanceState = {
  locked: boolean;
  /** Retained only for backward-compatible data loading; hidden behavior is no longer exposed. */
  hidden: boolean;
};

export type SemanticUnitInstance = {
  id: string;
  unitId: string;
  canvasPath: string;
  /** Maps canonical member IDs to the live IDs in this one canvas instance. */
  memberElementIds: Record<string, string>;
  origin: { x: number; y: number };
  appliedRevision: number;
  state: SemanticUnitInstanceState;
  missingMemberIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SemanticUnitBackupRecord = {
  id: string;
  sourcePath: string;
  backupPath: string;
  sourceHash: string;
  backupHash: string;
  reason: string;
  createdAt: string;
};

export type SemanticUnitsData = {
  schemaVersion: 1;
  units: Record<string, SemanticUnitDefinition>;
  instances: Record<string, SemanticUnitInstance>;
  manager: {
    search: string;
  };
  safety: {
    initialPluginDataBackup: SemanticUnitBackupRecord | null;
    recentCanvasBackups: SemanticUnitBackupRecord[];
  };
};

export type CreateSemanticUnitInput = {
  name: string;
  documentPath?: string | null;
  tags?: string[];
  properties?: Record<string, SemanticUnitJsonValue>;
  owner?: string | null;
  content: SemanticUnitContentSnapshot;
};

export type CreateSemanticUnitInstanceInput = {
  unitId: string;
  canvasPath: string;
  memberElementIds: Record<string, string>;
  origin: { x: number; y: number };
};

export type CreateSemanticUnitWithInstanceInput = CreateSemanticUnitInput & {
  instance: Omit<CreateSemanticUnitInstanceInput, "unitId">;
};

export const DEFAULT_SEMANTIC_UNITS_DATA: SemanticUnitsData = {
  schemaVersion: 1,
  units: {},
  instances: {},
  manager: {
    search: "",
  },
  safety: {
    initialPluginDataBackup: null,
    recentCanvasBackups: [],
  },
};
