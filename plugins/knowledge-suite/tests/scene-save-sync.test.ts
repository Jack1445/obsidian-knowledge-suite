import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the actual production method without importing the Electron/Obsidian
// dependency graph. Only its file/text services are stubbed; no vault is used.
const source = readFileSync(new URL("../src/shared/ExcalidrawData.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("ExcalidrawData.ts", source, ts.ScriptTarget.Latest, true);
const model = ast.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === "ExcalidrawData") as ts.ClassDeclaration;
const method = model.members.find((node) => ts.isMethodDeclaration(node) && node.name.getText(ast) === "syncElements")!;
const guard = ast.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => d.name.getText(ast) === "isAsyncOperationCurrent"))!;
const code = ts.transpileModule(`${guard.getText(ast)}\nclass Harness { ${method.getText(ast)} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
type Scene = { elements: { id: string; x: number }[]; files: Record<string, unknown> };
type Harness = ReturnType<typeof makeModel>;
const syncElements = new Function(`${code}; return Harness.prototype.syncElements;`)() as
  (this: Harness, scene: Scene, selected?: Record<string, boolean>, guard?: () => boolean) => Promise<boolean>;

function makeModel() {
  return {
    scene: { elements: [{ id: "old", x: 0 }], files: {} } as Scene,
    compatibilityMode: false,
    syncFiles: vi.fn().mockResolvedValue(false),
    updateElementLinksFromScene: vi.fn(),
    syncCroppedPDFs: vi.fn().mockReturnValue(false),
    setLinkPrefix: vi.fn().mockReturnValue(false),
    setUrlPrefix: vi.fn().mockReturnValue(false),
    setShowLinkBrackets: vi.fn().mockReturnValue(false),
    findNewElementLinksInScene: vi.fn().mockReturnValue(false),
    updateTextElementsFromScene: vi.fn().mockResolvedValue(undefined),
    findNewTextElementsInScene: vi.fn().mockReturnValue(false),
  };
}

describe("production scene save synchronization", () => {
  it.each([true, false])("adopts current edits before serialization (guarded=%s)", async (guarded) => {
    const model = makeModel();
    const latest: Scene = { elements: [{ id: "old", x: 100 }, { id: "new", x: 200 }], files: {} };
    await syncElements.call(model, latest, {}, guarded ? () => true : undefined);
    expect(model.scene).toBe(latest);
    expect(model.syncFiles).toHaveBeenCalledOnce();
    // A simulated serialize/reopen must retain new members and moved positions.
    expect(JSON.parse(JSON.stringify(model.scene)).elements).toEqual(latest.elements);
  });

  it.each(["false", "throws"])("rejects a stale entry guard (%s) without changing the old scene", async (kind) => {
    const model = makeModel();
    const original = model.scene;
    await syncElements.call(model, { elements: [], files: {} }, {}, () => {
      if (kind === "throws") throw new Error("unloaded");
      return false;
    });
    expect(model.scene).toBe(original);
    expect(model.syncFiles).not.toHaveBeenCalled();
  });

  it.each(["scene", "file"])("stops if the %s changes during asynchronous synchronization", async (kind) => {
    const model = makeModel();
    let current = true;
    const replacement: Scene = { elements: [{ id: "other-file", x: 9 }], files: { keep: true } };
    model.syncFiles.mockImplementation(async () => {
      if (kind === "scene") model.scene = replacement;
      else current = false;
      return false;
    });
    await syncElements.call(model, { elements: [], files: { keep: true } }, {}, () => current);
    expect(model.syncFiles).toHaveBeenCalledOnce();
    expect(model.updateElementLinksFromScene).not.toHaveBeenCalled();
    expect(model.scene.files).toEqual({ keep: true });
    if (kind === "scene") expect(model.scene).toBe(replacement);
  });
});
