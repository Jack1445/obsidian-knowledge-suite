import type { App, Plugin } from "obsidian";

const DATA_FORMAT = "knowledge-suite-data";
const DATA_SCHEMA_VERSION = 1;

type DataNamespaceKey = "excalidraw" | "knowledgeMap";

type KnowledgeSuiteDataEnvelope = {
  format: typeof DATA_FORMAT;
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  excalidraw: unknown;
  knowledgeMap: unknown;
  migrations?: {
    legacyImportV1?: LegacyImportRecord;
  };
};

type LegacyPluginId = "obsidian-excalidraw-plugin" | "knowledge-map";

type LegacyImportStatus = "imported" | "kept-existing" | "not-found";

type LegacyImportRecord = {
  completedAt: string;
  sources: Record<LegacyPluginId, {
    status: LegacyImportStatus;
    backupPath?: string;
  }>;
};

export type LegacyImportResult = LegacyImportRecord & {
  alreadyCompleted: boolean;
};

const LEGACY_DATA_SOURCES: ReadonlyArray<{
  id: LegacyPluginId;
  namespace: DataNamespaceKey;
}> = [
  { id: "obsidian-excalidraw-plugin", namespace: "excalidraw" },
  { id: "knowledge-map", namespace: "knowledgeMap" },
];

const joinVaultPath = (...parts: string[]): string =>
  parts
    .join("/")
    .replaceAll("\\", "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "");

export type KnowledgeSuiteDataNamespace<T = unknown> = {
  loadData(): Promise<T | null>;
  saveData(data: T): Promise<void>;
};

const isDataEnvelope = (value: unknown): value is KnowledgeSuiteDataEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.format === DATA_FORMAT &&
    record.schemaVersion === DATA_SCHEMA_VERSION &&
    "excalidraw" in record &&
    "knowledgeMap" in record
  );
};

/**
 * Serializes the two internal feature data sets through one Obsidian plugin
 * data file without allowing either feature to overwrite the other.
 */
export class KnowledgeSuiteDataCoordinator {
  private envelope: KnowledgeSuiteDataEnvelope | null = null;
  private loadPromise: Promise<KnowledgeSuiteDataEnvelope> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  public readonly excalidraw: KnowledgeSuiteDataNamespace =
    this.createNamespace("excalidraw");
  public readonly knowledgeMap: KnowledgeSuiteDataNamespace =
    this.createNamespace("knowledgeMap");

  constructor(private readonly plugin: Plugin) {}

  /**
   * Copies legacy plugin data into backups under the new plugin directory,
   * then imports it without modifying either legacy source file.
   */
  public async importLegacyData(app: App): Promise<LegacyImportResult> {
    const envelope = await this.loadEnvelope();
    const completed = envelope.migrations?.legacyImportV1;
    if (completed) {
      return { ...completed, alreadyCompleted: true };
    }

    const adapter = app.vault.adapter;
    const backupDirectory = joinVaultPath(
      app.vault.configDir,
      "plugins",
      "knowledge-suite",
      "migration-backups",
    );
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const sources = {} as LegacyImportRecord["sources"];

    for (const source of LEGACY_DATA_SOURCES) {
      const sourcePath = joinVaultPath(
        app.vault.configDir,
        "plugins",
        source.id,
        "data.json",
      );
      if (!(await adapter.exists(sourcePath))) {
        sources[source.id] = { status: "not-found" };
        continue;
      }

      const rawData = await adapter.read(sourcePath);
      if (!(await adapter.exists(backupDirectory))) {
        await adapter.mkdir(backupDirectory);
      }
      const backupPath = joinVaultPath(
        backupDirectory,
        `${source.id}-${timestamp}.json`,
      );
      await adapter.write(backupPath, rawData);

      const parsedData = JSON.parse(rawData) as unknown;
      const status: LegacyImportStatus = envelope[source.namespace] == null
        ? "imported"
        : "kept-existing";
      if (status === "imported") {
        envelope[source.namespace] = parsedData;
      }
      sources[source.id] = { status, backupPath };
    }

    const record: LegacyImportRecord = {
      completedAt: new Date().toISOString(),
      sources,
    };
    envelope.migrations ??= {};
    envelope.migrations.legacyImportV1 = record;
    await this.queueWrite();
    return { ...record, alreadyCompleted: false };
  }

  public getNamespace<T>(key: DataNamespaceKey): KnowledgeSuiteDataNamespace<T> {
    return this.createNamespace<T>(key);
  }

  private createNamespace<T = unknown>(
    key: DataNamespaceKey,
  ): KnowledgeSuiteDataNamespace<T> {
    return {
      loadData: async () => {
        const envelope = await this.loadEnvelope();
        return (envelope[key] as T) ?? null;
      },
      saveData: async (data: T) => {
        const envelope = await this.loadEnvelope();
        envelope[key] = data;
        await this.queueWrite();
      },
    };
  }

  private async loadEnvelope(): Promise<KnowledgeSuiteDataEnvelope> {
    if (this.envelope) {
      return this.envelope;
    }
    if (this.loadPromise === null) {
      this.loadPromise = this.plugin.loadData().then((rawData: unknown) => {
        this.envelope = isDataEnvelope(rawData)
          ? rawData
          : {
              format: DATA_FORMAT,
              schemaVersion: DATA_SCHEMA_VERSION,
              // A flat data file can only have come from the Excalidraw shell
              // before namespacing was introduced under the new plugin ID.
              excalidraw: rawData ?? null,
              knowledgeMap: null,
            };
        return this.envelope;
      });
    }
    return this.loadPromise;
  }

  private async queueWrite(): Promise<void> {
    const snapshot = JSON.parse(
      JSON.stringify(await this.loadEnvelope()),
    ) as KnowledgeSuiteDataEnvelope;
    const write = this.writeQueue
      .catch((): void => undefined)
      .then(() => this.plugin.saveData(snapshot));
    this.writeQueue = write;
    await write;
  }
}
