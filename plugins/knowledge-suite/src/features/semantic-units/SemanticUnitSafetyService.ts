import { nanoid } from "nanoid";
import type { App, DataAdapter } from "obsidian";
import type { SemanticUnitBackupRecord } from "./types";

const joinVaultPath = (...parts: string[]): string => parts
  .join("/")
  .replaceAll("\\", "/")
  .replace(/\/{2,}/g, "/")
  .replace(/^\//, "");

const sha256 = async (content: string): Promise<string> => {
  const digest = await activeWindow.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const ensureDirectory = async (adapter: DataAdapter, path: string): Promise<void> => {
  const parts = joinVaultPath(path).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await adapter.exists(current))) await adapter.mkdir(current);
  }
};

export class SemanticUnitSourceChangedError extends Error {
  constructor() {
    super("目标画布在操作期间发生了变化，本次写入已停止。");
    this.name = "SemanticUnitSourceChangedError";
  }
}

export type PreparedSemanticUnitCanvasWrite = {
  backup: SemanticUnitBackupRecord;
  originalContent: string;
  assertSourceUnchanged(): Promise<void>;
};

/**
 * Creates byte-for-byte backups outside the canvas tree and verifies both the
 * backup and source hash before a caller is allowed to perform a canvas write.
 */
export class SemanticUnitSafetyService {
  private readonly adapter: DataAdapter;
  private readonly backupRoot: string;

  constructor(private readonly app: App) {
    this.adapter = app.vault.adapter;
    this.backupRoot = joinVaultPath(
      app.vault.configDir,
      "plugins",
      "knowledge-suite",
      "semantic-unit-backups",
    );
  }

  public async backupInitialPluginData(): Promise<SemanticUnitBackupRecord> {
    const dataPath = joinVaultPath(
      this.app.vault.configDir,
      "plugins",
      "knowledge-suite",
      "data.json",
    );
    const content = await this.adapter.exists(dataPath)
      ? await this.adapter.read(dataPath)
      : "{}";
    return this.createVerifiedBackup(dataPath, content, "initial-plugin-data");
  }

  public async prepareCanvasWrite(
    canvasPath: string,
    reason: string,
  ): Promise<PreparedSemanticUnitCanvasWrite> {
    if (!(await this.adapter.exists(canvasPath))) {
      throw new Error("找不到要备份的二维画布。");
    }
    const originalContent = await this.adapter.read(canvasPath);
    const backup = await this.createVerifiedBackup(canvasPath, originalContent, reason);
    return {
      backup,
      originalContent,
      assertSourceUnchanged: async () => {
        const currentContent = await this.adapter.read(canvasPath);
        if (await sha256(currentContent) !== backup.sourceHash) {
          throw new SemanticUnitSourceChangedError();
        }
      },
    };
  }

  private async createVerifiedBackup(
    sourcePath: string,
    content: string,
    reason: string,
  ): Promise<SemanticUnitBackupRecord> {
    const createdAt = new Date().toISOString();
    const folder = joinVaultPath(
      this.backupRoot,
      createdAt.replaceAll(":", "-").replace(".", "-"),
    );
    const backupPath = joinVaultPath(folder, `${nanoid()}-${sourcePath}.bak`);
    const backupDirectory = backupPath.slice(0, backupPath.lastIndexOf("/"));
    await ensureDirectory(this.adapter, backupDirectory);
    const sourceHash = await sha256(content);
    await this.adapter.write(backupPath, content);
    const backupHash = await sha256(await this.adapter.read(backupPath));
    if (sourceHash !== backupHash) {
      throw new Error("语义单位备份校验失败，已停止后续写入。");
    }
    return {
      id: `backup-${nanoid()}`,
      sourcePath,
      backupPath,
      sourceHash,
      backupHash,
      reason,
      createdAt,
    };
  }
}
