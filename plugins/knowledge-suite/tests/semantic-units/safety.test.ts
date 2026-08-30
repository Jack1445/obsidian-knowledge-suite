import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { SemanticUnitSafetyService, SemanticUnitSourceChangedError } from "../../src/features/semantic-units/SemanticUnitSafetyService";

beforeEach(() => {
  vi.stubGlobal("activeWindow", { crypto: webcrypto });
});

describe("semantic unit canvas safety", () => {
  it("makes and verifies a byte-identical backup before allowing a write", async () => {
    const files = new Map<string, string>([["Canvas.md", "original drawing bytes"]]);
    const directories = new Set<string>([".obsidian", ".obsidian/plugins", ".obsidian/plugins/knowledge-suite"]);
    const app = {
      vault: {
        configDir: ".obsidian",
        adapter: {
          exists: async (path: string) => files.has(path) || directories.has(path),
          read: async (path: string) => files.get(path)!,
          write: async (path: string, value: string) => { files.set(path, value); },
          mkdir: async (path: string) => { directories.add(path); },
        },
      },
    } as unknown as App;
    const safety = new SemanticUnitSafetyService(app);

    const prepared = await safety.prepareCanvasWrite("Canvas.md", "create-unit");
    expect(files.get(prepared.backup.backupPath)).toBe("original drawing bytes");
    expect(prepared.backup.sourceHash).toBe(prepared.backup.backupHash);
    await expect(prepared.assertSourceUnchanged()).resolves.toBeUndefined();

    files.set("Canvas.md", "changed elsewhere");
    await expect(prepared.assertSourceUnchanged())
      .rejects.toBeInstanceOf(SemanticUnitSourceChangedError);
  });
});
