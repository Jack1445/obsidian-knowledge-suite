import {
  DEFAULT_SEMANTIC_UNITS_DATA,
  type SemanticUnitContentSnapshot,
  type SemanticUnitBackupRecord,
  type SemanticUnitDefinition,
  type SemanticUnitInstance,
  type SemanticUnitsData,
} from "./types";

const clone = <T>(value: T): T => structuredClone(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isContentSnapshot = (value: unknown): value is SemanticUnitContentSnapshot => {
  if (!isRecord(value) || !isRecord(value.bounds) || !Array.isArray(value.members)) {
    return false;
  }
  if (
    !finiteNumber(value.bounds.x) ||
    !finiteNumber(value.bounds.y) ||
    !finiteNumber(value.bounds.width) ||
    !finiteNumber(value.bounds.height) ||
    value.bounds.width < 0 ||
    value.bounds.height < 0 ||
    !isRecord(value.assets)
  ) {
    return false;
  }
  return value.members.every((member) =>
    isRecord(member) &&
    typeof member.memberId === "string" &&
    member.memberId.length > 0 &&
    isRecord(member.element),
  );
};

const isDefinition = (value: unknown): value is SemanticUnitDefinition => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.kind === "document-backed" || value.kind === "free") &&
    (typeof value.documentPath === "string" || value.documentPath === null) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    isRecord(value.properties) &&
    (typeof value.owner === "string" || value.owner === null) &&
    Number.isInteger(value.revision) &&
    (value.revision as number) >= 1 &&
    isContentSnapshot(value.content) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isInstance = (value: unknown): value is SemanticUnitInstance => {
  if (!isRecord(value) || !isRecord(value.origin) || !isRecord(value.state)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.unitId === "string" &&
    typeof value.canvasPath === "string" &&
    isRecord(value.memberElementIds) &&
    Object.values(value.memberElementIds).every((id) => typeof id === "string") &&
    finiteNumber(value.origin.x) &&
    finiteNumber(value.origin.y) &&
    Number.isInteger(value.appliedRevision) &&
    (value.appliedRevision as number) >= 1 &&
    typeof value.state.locked === "boolean" &&
    typeof value.state.hidden === "boolean" &&
    Array.isArray(value.missingMemberIds) &&
    value.missingMemberIds.every((id) => typeof id === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isBackupRecord = (value: unknown): value is SemanticUnitBackupRecord => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sourcePath === "string" &&
    typeof value.backupPath === "string" &&
    typeof value.sourceHash === "string" &&
    typeof value.backupHash === "string" &&
    typeof value.reason === "string" &&
    typeof value.createdAt === "string"
  );
};

/**
 * Normalization is deliberately non-destructive: unsupported future schemas
 * fail closed instead of being replaced and later overwritten with empty data.
 */
export const normalizeSemanticUnitsData = (raw: unknown): SemanticUnitsData => {
  if (raw === null || raw === undefined) return clone(DEFAULT_SEMANTIC_UNITS_DATA);
  if (!isRecord(raw) || raw.schemaVersion !== 1) {
    throw new Error("不支持的画布语义单位数据版本，已停止加载以保护现有数据。");
  }

  const units: Record<string, SemanticUnitDefinition> = {};
  if (isRecord(raw.units)) {
    for (const [unitId, unit] of Object.entries(raw.units)) {
      if (isDefinition(unit)) units[unitId] = unit;
    }
  }
  const instances: Record<string, SemanticUnitInstance> = {};
  if (isRecord(raw.instances)) {
    for (const [instanceId, instance] of Object.entries(raw.instances)) {
      if (isInstance(instance)) instances[instanceId] = instance;
    }
  }

  return {
    schemaVersion: 1,
    units: clone(units),
    instances: clone(instances),
    manager: {
      search: isRecord(raw.manager) && typeof raw.manager.search === "string"
        ? raw.manager.search
        : "",
    },
    safety: {
      initialPluginDataBackup: isRecord(raw.safety) &&
        isBackupRecord(raw.safety.initialPluginDataBackup)
        ? clone(raw.safety.initialPluginDataBackup)
        : null,
      recentCanvasBackups: isRecord(raw.safety) &&
        Array.isArray(raw.safety.recentCanvasBackups)
        ? clone(raw.safety.recentCanvasBackups.filter(isBackupRecord).slice(0, 100))
        : [],
    },
  };
};
