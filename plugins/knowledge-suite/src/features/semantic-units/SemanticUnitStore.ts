import type { KnowledgeSuiteDataNamespace } from "../../core/KnowledgeSuiteDataCoordinator";
import { nanoid } from "nanoid";
import { normalizeSemanticUnitsData } from "./schema";
import {
  type CreateSemanticUnitInput,
  type CreateSemanticUnitInstanceInput,
  type CreateSemanticUnitWithInstanceInput,
  type SemanticUnitContentSnapshot,
  type SemanticUnitBackupRecord,
  type SemanticUnitDefinition,
  type SemanticUnitInstance,
  type SemanticUnitsData,
} from "./types";

export class SemanticUnitRevisionConflictError extends Error {
  constructor() {
    super("语义单位已在其他实例中更新，本次写入已停止。");
    this.name = "SemanticUnitRevisionConflictError";
  }
}

const clone = <T>(value: T): T => structuredClone(value);

const createId = (prefix: "unit" | "instance"): string => `${prefix}-${nanoid()}`;

const normalizeTags = (tags: readonly string[] | undefined): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawTag of tags ?? []) {
    const tag = rawTag.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    output.push(tag);
  }
  return output;
};

const normalizedPath = (path: string | null | undefined): string | null => {
  const value = path?.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  return value || null;
};

const validateName = (data: SemanticUnitsData, name: string, exceptId?: string): string => {
  const normalized = name.trim();
  if (!normalized) throw new Error("元素单位名称不能为空。");
  const duplicate = Object.values(data.units).some((unit) =>
    unit.id !== exceptId &&
    unit.name.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
  );
  if (duplicate) throw new Error(`元素单位“${normalized}”已存在。`);
  return normalized;
};

const validateMemberMap = (
  content: SemanticUnitContentSnapshot,
  memberElementIds: Record<string, string>,
): void => {
  const canonicalIds = new Set(content.members.map((member) => member.memberId));
  const mappedIds = Object.keys(memberElementIds);
  if (
    canonicalIds.size === 0 ||
    canonicalIds.size !== mappedIds.length ||
    mappedIds.some((id) => !canonicalIds.has(id)) ||
    new Set(Object.values(memberElementIds)).size !== mappedIds.length
  ) {
    throw new Error("语义单位实例的成员映射不完整或包含重复元素。");
  }
};

export class SemanticUnitStore {
  private data: SemanticUnitsData = normalizeSemanticUnitsData(null);
  private writeQueue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly persistence: KnowledgeSuiteDataNamespace<SemanticUnitsData>,
  ) {}

  public async load(): Promise<void> {
    this.data = normalizeSemanticUnitsData(await this.persistence.loadData());
  }

  public getUnits(): SemanticUnitDefinition[] {
    return clone(Object.values(this.data.units));
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getManagerSearch(): string {
    return this.data.manager.search;
  }

  public getUnit(unitId: string): SemanticUnitDefinition | null {
    const unit = this.data.units[unitId];
    return unit ? clone(unit) : null;
  }

  public getInstance(instanceId: string): SemanticUnitInstance | null {
    const instance = this.data.instances[instanceId];
    return instance ? clone(instance) : null;
  }

  public getInstancesForUnit(unitId: string): SemanticUnitInstance[] {
    return clone(Object.values(this.data.instances).filter((instance) => instance.unitId === unitId));
  }

  public getInstancesForCanvas(canvasPath: string): SemanticUnitInstance[] {
    return clone(Object.values(this.data.instances).filter((instance) => instance.canvasPath === canvasPath));
  }

  public getInstanceByElement(canvasPath: string, elementId: string): SemanticUnitInstance | null {
    const instance = Object.values(this.data.instances).find((candidate) =>
      candidate.canvasPath === canvasPath &&
      Object.values(candidate.memberElementIds).includes(elementId),
    );
    return instance ? clone(instance) : null;
  }

  public async createUnitWithInstance(
    input: CreateSemanticUnitWithInstanceInput,
  ): Promise<{ unit: SemanticUnitDefinition; instance: SemanticUnitInstance }> {
    return this.mutate((data) => {
      const unit = this.buildUnit(data, input);
      const instance = this.buildInstance(data, unit, {
        ...input.instance,
        unitId: unit.id,
      });
      data.units[unit.id] = unit;
      data.instances[instance.id] = instance;
      return { unit: clone(unit), instance: clone(instance) };
    });
  }

  public async createUnit(input: CreateSemanticUnitInput): Promise<SemanticUnitDefinition> {
    return this.mutate((data) => {
      const unit = this.buildUnit(data, input);
      data.units[unit.id] = unit;
      return clone(unit);
    });
  }

  public async createSynchronizedInstance(
    input: CreateSemanticUnitInstanceInput,
  ): Promise<SemanticUnitInstance> {
    return this.mutate((data) => {
      const unit = data.units[input.unitId];
      if (!unit) throw new Error("找不到要引入的元素单位。");
      const instance = this.buildInstance(data, unit, input);
      data.instances[instance.id] = instance;
      return clone(instance);
    });
  }

  public async renameUnit(unitId: string, name: string): Promise<void> {
    await this.mutate((data) => {
      const unit = data.units[unitId];
      if (!unit) throw new Error("元素单位不存在。");
      unit.name = validateName(data, name, unitId);
      unit.updatedAt = new Date().toISOString();
    });
  }

  /** Updates only the Markdown relationship; canvas content and instances stay untouched. */
  public async updateUnitDocumentPath(
    unitId: string,
    documentPath: string | null,
  ): Promise<void> {
    await this.mutate((data) => {
      const unit = data.units[unitId];
      if (!unit) throw new Error("元素单位不存在。");
      const normalizedDocumentPath = normalizedPath(documentPath);
      unit.documentPath = normalizedDocumentPath;
      unit.kind = normalizedDocumentPath ? "document-backed" : "free";
      unit.updatedAt = new Date().toISOString();
    });
  }

  public async replaceCanonicalContent(
    unitId: string,
    expectedRevision: number,
    content: SemanticUnitContentSnapshot,
  ): Promise<number> {
    return this.mutate((data) => {
      const unit = data.units[unitId];
      if (!unit) throw new Error("元素单位不存在。");
      if (unit.revision !== expectedRevision) throw new SemanticUnitRevisionConflictError();
      unit.content = clone(content);
      unit.revision += 1;
      unit.updatedAt = new Date().toISOString();
      return unit.revision;
    });
  }

  public async updateInstanceMembers(
    instanceId: string,
    memberElementIds: Record<string, string>,
    appliedRevision: number,
  ): Promise<void> {
    await this.mutate((data) => {
      const instance = data.instances[instanceId];
      const unit = instance ? data.units[instance.unitId] : null;
      if (!instance || !unit) throw new Error("语义单位实例不存在。");
      validateMemberMap(unit.content, memberElementIds);
      instance.memberElementIds = { ...memberElementIds };
      instance.appliedRevision = appliedRevision;
      instance.missingMemberIds = [];
      instance.updatedAt = new Date().toISOString();
    });
  }

  public async updateInstanceOrigin(
    instanceId: string,
    origin: { x: number; y: number },
  ): Promise<void> {
    await this.mutate((data) => {
      const instance = data.instances[instanceId];
      if (!instance) return;
      instance.origin = { ...origin };
      instance.updatedAt = new Date().toISOString();
    });
  }

  public async updateInstanceLocked(instanceId: string, locked: boolean): Promise<void> {
    await this.mutate((data) => {
      const instance = data.instances[instanceId];
      if (!instance) throw new Error("语义单位实例不存在。");
      instance.state = { ...instance.state, locked };
      instance.updatedAt = new Date().toISOString();
    });
  }

  public async updateUnitInstancesLocked(unitId: string, locked: boolean): Promise<void> {
    await this.mutate((data) => {
      if (!data.units[unitId]) throw new Error("元素单位不存在。");
      const timestamp = new Date().toISOString();
      for (const instance of Object.values(data.instances)) {
        if (instance.unitId !== unitId) continue;
        instance.state = { ...instance.state, locked };
        instance.updatedAt = timestamp;
      }
    });
  }

  public async markMissingMembers(instanceId: string, memberIds: readonly string[]): Promise<void> {
    await this.mutate((data) => {
      const instance = data.instances[instanceId];
      if (!instance) return;
      instance.missingMemberIds = [...new Set(memberIds)].sort();
      instance.updatedAt = new Date().toISOString();
    });
  }

  /** Removes semantic registration only. It never deletes canvas elements. */
  public async dissolveInstance(instanceId: string): Promise<void> {
    await this.mutate((data) => {
      delete data.instances[instanceId];
    });
  }

  /** Removes semantic registration only. It never deletes canvas elements or Markdown files. */
  public async dissolveUnit(unitId: string): Promise<void> {
    await this.mutate((data) => {
      delete data.units[unitId];
      for (const [instanceId, instance] of Object.entries(data.instances)) {
        if (instance.unitId === unitId) delete data.instances[instanceId];
      }
    });
  }

  public async remapPath(oldPath: string, newPath: string): Promise<void> {
    const oldPrefix = `${oldPath}/`;
    const map = (path: string): string => path === oldPath
      ? newPath
      : path.startsWith(oldPrefix)
        ? `${newPath}${path.slice(oldPath.length)}`
        : path;
    await this.mutate((data) => {
      for (const unit of Object.values(data.units)) {
        if (unit.documentPath) unit.documentPath = map(unit.documentPath);
      }
      for (const instance of Object.values(data.instances)) {
        instance.canvasPath = map(instance.canvasPath);
      }
    });
  }

  public async setManagerSearch(search: string): Promise<void> {
    await this.mutate((data) => {
      data.manager.search = search;
    });
  }

  public getInitialPluginDataBackup(): SemanticUnitBackupRecord | null {
    return clone(this.data.safety.initialPluginDataBackup);
  }

  public async recordInitialPluginDataBackup(record: SemanticUnitBackupRecord): Promise<void> {
    await this.mutate((data) => {
      data.safety.initialPluginDataBackup ??= clone(record);
    });
  }

  public async recordCanvasBackup(record: SemanticUnitBackupRecord): Promise<void> {
    await this.mutate((data) => {
      data.safety.recentCanvasBackups = [
        clone(record),
        ...data.safety.recentCanvasBackups.filter((item) => item.id !== record.id),
      ].slice(0, 100);
    });
  }

  private buildUnit(
    data: SemanticUnitsData,
    input: CreateSemanticUnitInput,
  ): SemanticUnitDefinition {
    if (input.content.members.length === 0) throw new Error("至少选择一个画布元素。");
    const documentPath = normalizedPath(input.documentPath);
    const timestamp = new Date().toISOString();
    return {
      id: createId("unit"),
      name: validateName(data, input.name),
      kind: documentPath ? "document-backed" : "free",
      documentPath,
      tags: normalizeTags(input.tags),
      properties: clone(input.properties ?? {}),
      owner: input.owner?.trim() || null,
      revision: 1,
      content: clone(input.content),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private buildInstance(
    data: SemanticUnitsData,
    unit: SemanticUnitDefinition,
    input: CreateSemanticUnitInstanceInput,
  ): SemanticUnitInstance {
    const canvasPath = normalizedPath(input.canvasPath);
    if (!canvasPath) throw new Error("二维画布路径不能为空。");
    validateMemberMap(unit.content, input.memberElementIds);
    for (const elementId of Object.values(input.memberElementIds)) {
      const collision = Object.values(data.instances).some((instance) =>
        instance.canvasPath === canvasPath &&
        Object.values(instance.memberElementIds).includes(elementId),
      );
      if (collision) throw new Error("所选元素已经属于另一个语义单位实例。");
    }
    const timestamp = new Date().toISOString();
    return {
      id: createId("instance"),
      unitId: unit.id,
      canvasPath,
      memberElementIds: { ...input.memberElementIds },
      origin: { ...input.origin },
      appliedRevision: unit.revision,
      state: { locked: false, hidden: false },
      missingMemberIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async mutate<TResult>(
    mutation: (data: SemanticUnitsData) => TResult,
  ): Promise<TResult> {
    const operation = this.writeQueue
      .catch((): void => undefined)
      .then(async () => {
        const next = clone(this.data);
        const result = mutation(next);
        await this.persistence.saveData(next);
        this.data = next;
        for (const listener of this.listeners) listener();
        return result;
      });
    this.writeQueue = operation;
    return operation;
  }
}
