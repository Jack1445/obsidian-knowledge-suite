import { normalizePath, TFile, type App, type Plugin } from "obsidian";
import type { KnowledgeSuiteDataNamespace } from "../../core/KnowledgeSuiteDataCoordinator";
import {
  findDocumentFieldBlocks,
  parseDocumentFieldValues,
  updateDocumentFieldValue,
} from "./fieldBlock";
import { matchesDocumentFilter } from "./filter";
import {
  clampDocumentColumnWidth,
  deriveDocumentFieldKey,
  normalizeDocumentMetadataData,
} from "./schema";
import {
  type CreateDocumentFieldInput,
  type DocumentFieldDefinition,
  type DocumentFieldValue,
  type DocumentFieldValues,
  type DocumentFilterDefinition,
  type DocumentMetadataData,
  type UpdateDocumentFieldInput,
} from "./types";

export class DocumentMetadataConflictError extends Error {
  constructor() {
    super("文档在保存前已被其他操作修改，本次写入已停止。");
    this.name = "DocumentMetadataConflictError";
  }
}

export type DocumentMetadataWriteResult = {
  backupPath: string | null;
  createdBlock: boolean;
  values: DocumentFieldValues;
};

type MetadataListener = (filePath?: string) => void;
type DocumentMetadataHost = Plugin & {
  isExcalidrawFile(file: TFile): boolean;
};

const normalizedOptions = (options: readonly string[] | undefined): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const option of options ?? []) {
    const value = option.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
};

const fieldKeyIsValid = (key: string): boolean =>
  /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(key) &&
  !["__proto__", "constructor", "prototype"].includes(key.toLocaleLowerCase());

const createFieldId = (): string =>
  `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const valueEquals = (left: DocumentFieldValue | undefined, right: DocumentFieldValue | undefined): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const sha256 = async (content: string): Promise<string> => {
  const digest = await activeWindow.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Owns the Markdown field schema, safe field-block writes, incremental cache,
 * and UI-independent filtering used by document views and future canvases.
 */
export class DocumentMetadataService {
  private data: DocumentMetadataData = normalizeDocumentMetadataData(null);
  private readonly cache = new Map<string, DocumentFieldValues>();
  private readonly listeners = new Set<MetadataListener>();
  private readonly writeQueues = new Map<string, Promise<DocumentMetadataWriteResult>>();

  constructor(
    private readonly app: App,
    private readonly host: DocumentMetadataHost,
    private readonly persistence: KnowledgeSuiteDataNamespace<DocumentMetadataData>,
  ) {}

  public async initialize(): Promise<void> {
    this.data = normalizeDocumentMetadataData(await this.persistence.loadData());
    this.host.registerEvent(this.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.cache.delete(file.path);
      this.emit(file.path);
    }));
    this.host.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.cache.delete(oldPath);
      this.cache.delete(file.path);
      this.emit(file.path);
    }));
    this.host.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.cache.delete(file.path);
      this.emit(file.path);
    }));
    this.host.registerEvent(this.app.vault.on("create", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.emit(file.path);
    }));
  }

  public getFields(): DocumentFieldDefinition[] {
    return this.data.fields
      .map((field) => ({ ...field, options: [...field.options] }));
  }

  public getField(fieldId: string): DocumentFieldDefinition | null {
    const field = this.data.fields.find((candidate) => candidate.id === fieldId);
    return field ? { ...field, options: [...field.options] } : null;
  }

  public async createField(input: CreateDocumentFieldInput): Promise<DocumentFieldDefinition> {
    const name = input.name.trim();
    if (!name) throw new Error("字段名称不能为空。");
    const sameName = this.data.fields.find(
      (field) => field.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (sameName) throw new Error(`字段“${name}”已存在。`);
    const normalizedName = name.toLocaleLowerCase();
    const key = input.key?.trim() || this.data.deletedFieldKeys[normalizedName] || deriveDocumentFieldKey(name);
    if (!fieldKeyIsValid(key)) {
      throw new Error("字段名称需要至少包含一个中文、字母或数字字符。");
    }
    const existingField = this.data.fields.find(
      (field) => field.key.toLocaleLowerCase() === key.toLocaleLowerCase(),
    );
    if (existingField) {
      throw new Error(`字段“${existingField.name}”已存在。`);
    }
    const timestamp = new Date().toISOString();
    const field: DocumentFieldDefinition = {
      id: createFieldId(),
      key,
      name,
      type: input.type,
      options: normalizedOptions(input.options),
      color: input.color,
      defaultInDocument: Boolean(input.defaultInDocument),
      visibleInDocument: true,
      visibleInManager: true,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.fields.push(field);
    delete this.data.deletedFieldKeys[normalizedName];
    await this.saveData();
    this.emit();
    return { ...field, options: [...field.options] };
  }

  public async updateField(fieldId: string, patch: UpdateDocumentFieldInput): Promise<void> {
    const field = this.data.fields.find((candidate) => candidate.id === fieldId);
    if (!field) throw new Error("字段不存在。");
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error("字段名称不能为空。");
      if (this.data.fields.some((candidate) => (
        candidate.id !== fieldId &&
        candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      ))) {
        throw new Error(`字段“${name}”已存在。`);
      }
      field.name = name;
    }
    if (patch.type !== undefined) field.type = patch.type;
    if (patch.options !== undefined) field.options = normalizedOptions(patch.options);
    if (patch.color !== undefined) field.color = patch.color || undefined;
    if (patch.defaultInDocument !== undefined) field.defaultInDocument = patch.defaultInDocument;
    if (patch.visibleInDocument !== undefined) field.visibleInDocument = patch.visibleInDocument;
    if (patch.visibleInManager !== undefined) field.visibleInManager = patch.visibleInManager;
    field.updatedAt = new Date().toISOString();
    await this.saveData();
    this.emit();
  }

  /** Deletes only the schema definition; values in Markdown remain untouched. */
  public async deleteField(fieldId: string): Promise<void> {
    const index = this.data.fields.findIndex((candidate) => candidate.id === fieldId);
    if (index < 0) return;
    const [field] = this.data.fields.splice(index, 1);
    this.data.deletedFieldKeys[field.name.trim().toLocaleLowerCase()] = field.key;
    delete this.data.manager.columnWidths?.[fieldId];
    for (const filter of Object.values(this.data.filtersByContext)) {
      filter.conditions = filter.conditions.filter((condition) => condition.fieldId !== fieldId);
    }
    await this.saveData();
    this.emit();
  }

  public async moveField(fieldId: string, direction: -1 | 1): Promise<void> {
    const index = this.data.fields.findIndex((field) => field.id === fieldId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.data.fields.length) return;
    const [field] = this.data.fields.splice(index, 1);
    this.data.fields.splice(target, 0, field);
    await this.saveData();
    this.emit();
  }

  public async reorderField(
    fieldId: string,
    targetFieldId: string,
    position: "before" | "after",
  ): Promise<void> {
    if (fieldId === targetFieldId) return;
    const sourceIndex = this.data.fields.findIndex((field) => field.id === fieldId);
    if (sourceIndex < 0) return;
    const [field] = this.data.fields.splice(sourceIndex, 1);
    const targetIndex = this.data.fields.findIndex((candidate) => candidate.id === targetFieldId);
    if (targetIndex < 0) {
      this.data.fields.splice(sourceIndex, 0, field);
      return;
    }
    this.data.fields.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, field);
    await this.saveData();
    this.emit();
  }

  public getFileColumnWidth(): number {
    return clampDocumentColumnWidth(this.data.manager.fileColumnWidth ?? 200, true);
  }

  public getFieldColumnWidth(fieldId: string): number {
    return clampDocumentColumnWidth(this.data.manager.columnWidths?.[fieldId] ?? 180);
  }

  public async setFileColumnWidth(width: number): Promise<void> {
    this.data.manager.fileColumnWidth = clampDocumentColumnWidth(width, true);
    await this.saveData();
  }

  public async setFieldColumnWidth(fieldId: string, width: number): Promise<void> {
    this.data.manager.columnWidths ??= {};
    this.data.manager.columnWidths[fieldId] = clampDocumentColumnWidth(width);
    await this.saveData();
  }

  public getSavedFilter(contextKey: string): DocumentFilterDefinition {
    const filter = this.data.filtersByContext[contextKey];
    return filter
      ? JSON.parse(JSON.stringify(filter)) as DocumentFilterDefinition
      : { match: "all", conditions: [] };
  }

  public async saveFilter(contextKey: string, filter: DocumentFilterDefinition): Promise<void> {
    this.data.filtersByContext[contextKey] = JSON.parse(JSON.stringify(filter)) as DocumentFilterDefinition;
    await this.saveData();
    this.emit();
  }

  public subscribe(listener: MetadataListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getMarkdownFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles()
      .filter((file) => this.isManagedMarkdownFile(file))
      .sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
  }

  public isManagedMarkdownFile(file: TFile | null): file is TFile {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return !(frontmatter && "excalidraw-plugin" in frontmatter) && !this.host.isExcalidrawFile(file);
  }

  public async getValues(file: TFile, force = false): Promise<DocumentFieldValues> {
    if (!force && this.cache.has(file.path)) return { ...this.cache.get(file.path) };
    const content = await this.app.vault.cachedRead(file);
    const blocks = findDocumentFieldBlocks(content);
    if (blocks.length > 1) {
      throw new Error("文档包含多个 Knowledge Suite 字段块。");
    }
    const values = blocks[0] ? parseDocumentFieldValues(blocks[0].source) : {};
    this.cache.set(file.path, values);
    return { ...values };
  }

  public hasFieldBlock(file: TFile): Promise<boolean> {
    return this.app.vault.cachedRead(file).then((content) => findDocumentFieldBlocks(content).length === 1);
  }

  public async ensureFieldBlock(file: TFile): Promise<DocumentMetadataWriteResult> {
    const existing = await this.getValues(file, true);
    if (await this.hasFieldBlock(file)) {
      return { backupPath: null, createdBlock: false, values: existing };
    }
    const original = await this.app.vault.read(file);
    const keyOrder = this.data.fields.map((field) => field.key);
    const update = updateDocumentFieldValue(original, "__knowledge_suite_placeholder__", undefined, keyOrder);
    const backupPath = await this.backupOriginal(file, original, "插入字段面板");
    await this.app.vault.process(file, (current) => {
      if (current !== original) throw new DocumentMetadataConflictError();
      return update.content;
    });
    this.cache.set(file.path, update.values);
    this.emit(file.path);
    return { backupPath, createdBlock: true, values: update.values };
  }

  public async setFieldValue(
    file: TFile,
    fieldId: string,
    rawValue: DocumentFieldValue | undefined,
  ): Promise<DocumentMetadataWriteResult> {
    if (!this.isManagedMarkdownFile(file)) {
      throw new Error("标签与属性当前只支持普通 Markdown 文档，不会修改 Excalidraw 画布文件。");
    }
    const previous = this.writeQueues.get(file.path) ?? Promise.resolve({
      backupPath: null,
      createdBlock: false,
      values: {},
    });
    const write = previous
      .catch((): DocumentMetadataWriteResult => ({
        backupPath: null,
        createdBlock: false,
        values: {},
      }))
      .then(() => this.performFieldWrite(file, fieldId, rawValue));
    this.writeQueues.set(file.path, write);
    try {
      return await write;
    } finally {
      if (this.writeQueues.get(file.path) === write) this.writeQueues.delete(file.path);
    }
  }

  public async filterFiles(
    files: readonly TFile[],
    filter: DocumentFilterDefinition,
  ): Promise<TFile[]> {
    const fields = this.getFields();
    const matches = await Promise.all(files.map(async (file) => ({
      file,
      matches: await this.getValues(file)
        .then((values) => matchesDocumentFilter(values, fields, filter))
        .catch(() => false),
    })));
    return matches.filter((entry) => entry.matches).map((entry) => entry.file);
  }

  private async performFieldWrite(
    file: TFile,
    fieldId: string,
    rawValue: DocumentFieldValue | undefined,
  ): Promise<DocumentMetadataWriteResult> {
    const field = this.data.fields.find((candidate) => candidate.id === fieldId);
    if (!field) throw new Error("字段不存在。");
    const value = this.normalizeValue(field, rawValue);
    const original = await this.app.vault.read(file);
    const originalBlocks = findDocumentFieldBlocks(original);
    if (originalBlocks.length === 0 && value === undefined) {
      this.cache.set(file.path, {});
      return { backupPath: null, createdBlock: false, values: {} };
    }
    const keyOrder = this.data.fields.map((candidate) => candidate.key);
    const update = updateDocumentFieldValue(original, field.key, value, keyOrder);
    const currentValue = originalBlocks[0]
      ? parseDocumentFieldValues(originalBlocks[0].source)[field.key]
      : undefined;
    if (update.content === original || valueEquals(currentValue, value)) {
      this.cache.set(file.path, update.values);
      return { backupPath: null, createdBlock: false, values: { ...update.values } };
    }

    const backupPath = await this.backupOriginal(file, original, `更新字段：${field.name}`);
    await this.app.vault.process(file, (current) => {
      if (current !== original) throw new DocumentMetadataConflictError();
      return update.content;
    });
    const verifiedContent = await this.app.vault.read(file);
    const verifiedBlocks = findDocumentFieldBlocks(verifiedContent);
    if (verifiedBlocks.length !== 1) throw new Error("写入后的字段块校验失败，原文件备份已保留。");
    const verifiedValues = parseDocumentFieldValues(verifiedBlocks[0].source);
    if (!valueEquals(verifiedValues[field.key], value)) {
      throw new Error("写入后的字段值校验失败，原文件备份已保留。");
    }
    this.cache.set(file.path, verifiedValues);
    this.emit(file.path);
    return { backupPath, createdBlock: update.createdBlock, values: { ...verifiedValues } };
  }

  private normalizeValue(
    field: DocumentFieldDefinition,
    rawValue: DocumentFieldValue | undefined,
  ): DocumentFieldValue | undefined {
    if (rawValue === undefined || rawValue === null || rawValue === "") return undefined;
    if (field.type === "checkbox") return Boolean(rawValue);
    if (field.type === "number") {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) throw new Error(`“${field.name}”必须是有效数字。`);
      return value;
    }
    if (field.type === "multi-select" || field.type === "tags") {
      const values = (Array.isArray(rawValue) ? rawValue : String(rawValue).split(","))
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean);
      return [...new Set(values)];
    }
    const value = String(Array.isArray(rawValue) ? rawValue[0] ?? "" : rawValue).trim();
    if (field.type === "single-select" && field.options.length > 0 && !field.options.includes(value)) {
      throw new Error(`“${value}”不是字段“${field.name}”的有效选项。`);
    }
    return value || undefined;
  }

  private async backupOriginal(file: TFile, content: string, reason: string): Promise<string> {
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const root = normalizePath([
      this.app.vault.configDir,
      "plugins",
      "knowledge-suite",
      "metadata-backups",
      `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    ].join("/"));
    const backupPath = normalizePath(`${root}/${file.path}`);
    await this.ensureDirectory(backupPath.slice(0, backupPath.lastIndexOf("/")));
    await this.app.vault.adapter.write(backupPath, content);
    await this.app.vault.adapter.write(
      normalizePath(`${root}/manifest.json`),
      JSON.stringify({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        filePath: file.path,
        backupPath,
        reason,
        originalSize: content.length,
        sha256: await sha256(content),
      }, null, 2),
    );
    return backupPath;
  }

  private async ensureDirectory(path: string): Promise<void> {
    const parts = normalizePath(path).split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.adapter.mkdir(current);
      }
    }
  }

  private async saveData(): Promise<void> {
    await this.persistence.saveData(this.data);
  }

  private emit(filePath?: string): void {
    for (const listener of this.listeners) listener(filePath);
  }
}
