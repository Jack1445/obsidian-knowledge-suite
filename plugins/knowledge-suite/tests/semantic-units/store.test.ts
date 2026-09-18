import { describe, expect, it } from "vitest";
import type { KnowledgeSuiteDataNamespace } from "../../src/core/KnowledgeSuiteDataCoordinator";
import { SemanticUnitRevisionConflictError, SemanticUnitStore } from "../../src/features/semantic-units/SemanticUnitStore";
import type { SemanticUnitContentSnapshot, SemanticUnitsData } from "../../src/features/semantic-units/types";

const content: SemanticUnitContentSnapshot = {
  bounds: { x: 0, y: 0, width: 220, height: 100 },
  members: [
    { memberId: "member-a", element: { id: "member-a", type: "rectangle", x: 0, y: 0 } },
    { memberId: "member-b", element: { id: "member-b", type: "text", x: 20, y: 20 } },
  ],
  assets: {},
};

const createStore = () => {
  let persisted: SemanticUnitsData | null = null;
  const persistence: KnowledgeSuiteDataNamespace<SemanticUnitsData> = {
    loadData: async () => persisted,
    saveData: async (data) => {
      persisted = structuredClone(data);
    },
  };
  return { store: new SemanticUnitStore(persistence), persisted: () => persisted };
};

describe("semantic unit store", () => {
  it("atomically creates a named unit and its first registered instance", async () => {
    const { store, persisted } = createStore();
    await store.load();
    const created = await store.createUnitWithInstance({
      name: "触觉方法概览",
      documentPath: "论文阅读笔记/ReTouch.md",
      content,
      instance: {
        canvasPath: "论文阅读笔记/画布-触觉-2023.md",
        memberElementIds: { "member-a": "live-a", "member-b": "live-b" },
        origin: { x: 420, y: 180 },
      },
    });

    expect(created.unit.kind).toBe("document-backed");
    expect(created.instance.appliedRevision).toBe(1);
    expect(persisted()?.units[created.unit.id]?.name).toBe("触觉方法概览");
  });

  it("only recognizes explicitly registered live element IDs", async () => {
    const { store } = createStore();
    await store.load();
    const { instance } = await store.createUnitWithInstance({
      name: "自由单位",
      content,
      instance: {
        canvasPath: "Canvas A.md",
        memberElementIds: { "member-a": "live-a", "member-b": "live-b" },
        origin: { x: 0, y: 0 },
      },
    });

    expect(store.getInstanceByElement("Canvas A.md", "live-a")?.id).toBe(instance.id);
    expect(store.getInstanceByElement("Canvas A.md", "pasted-new-id")).toBeNull();
    expect(store.getInstanceByElement("Canvas B.md", "live-a")).toBeNull();
  });

  it("creates an explicit synchronized instance while preserving independent outer positions", async () => {
    const { store } = createStore();
    await store.load();
    const { unit } = await store.createUnitWithInstance({
      name: "同步单位",
      content,
      instance: {
        canvasPath: "Canvas A.md",
        memberElementIds: { "member-a": "a-1", "member-b": "a-2" },
        origin: { x: 10, y: 20 },
      },
    });
    const second = await store.createSynchronizedInstance({
      unitId: unit.id,
      canvasPath: "Canvas B.md",
      memberElementIds: { "member-a": "b-1", "member-b": "b-2" },
      origin: { x: 900, y: 600 },
    });

    expect(store.getInstancesForUnit(unit.id)).toHaveLength(2);
    expect(second.origin).toEqual({ x: 900, y: 600 });
  });

  it("updates semantic state without changing canvas member identity", async () => {
    const { store } = createStore();
    await store.load();
    const { instance } = await store.createUnitWithInstance({
      name: "状态单位",
      content,
      instance: {
        canvasPath: "Canvas A.md",
        memberElementIds: { "member-a": "live-a", "member-b": "live-b" },
        origin: { x: 10, y: 20 },
      },
    });

    await store.updateInstanceLocked(instance.id, true);
    const updated = store.getInstance(instance.id);
    expect(updated?.state).toEqual({ locked: true, hidden: false });
    expect(updated?.memberElementIds).toEqual(instance.memberElementIds);
    expect(updated?.origin).toEqual(instance.origin);
  });

  it("updates every instance of one unit without affecting another unit", async () => {
    const { store } = createStore();
    await store.load();
    const first = await store.createUnitWithInstance({
      name: "批量状态单位",
      content,
      instance: {
        canvasPath: "Canvas A.md",
        memberElementIds: { "member-a": "a-1", "member-b": "a-2" },
        origin: { x: 0, y: 0 },
      },
    });
    await store.createSynchronizedInstance({
      unitId: first.unit.id,
      canvasPath: "Canvas B.md",
      memberElementIds: { "member-a": "b-1", "member-b": "b-2" },
      origin: { x: 100, y: 100 },
    });
    const other = await store.createUnitWithInstance({
      name: "其他单位",
      content,
      instance: {
        canvasPath: "Canvas C.md",
        memberElementIds: { "member-a": "c-1", "member-b": "c-2" },
        origin: { x: 0, y: 0 },
      },
    });

    await store.updateUnitInstancesLocked(first.unit.id, true);
    expect(store.getInstancesForUnit(first.unit.id).every((item) => item.state.locked)).toBe(true);
    expect(store.getInstance(other.instance.id)?.state.locked).toBe(false);
  });

  it("changes or removes a Markdown relationship without touching unit content or instances", async () => {
    const { store } = createStore();
    await store.load();
    const created = await store.createUnitWithInstance({
      name: "可换依托单位",
      documentPath: "旧文件.md",
      content,
      instance: {
        canvasPath: "Canvas.md",
        memberElementIds: { "member-a": "live-a", "member-b": "live-b" },
        origin: { x: 12, y: 24 },
      },
    });

    await store.updateUnitDocumentPath(created.unit.id, " /论文阅读笔记\\新文件.md ");
    const rebound = store.getUnit(created.unit.id);
    expect(rebound?.documentPath).toBe("论文阅读笔记/新文件.md");
    expect(rebound?.kind).toBe("document-backed");
    expect(rebound?.revision).toBe(created.unit.revision);
    expect(rebound?.content).toEqual(created.unit.content);
    expect(store.getInstance(created.instance.id)).toEqual(created.instance);

    await store.updateUnitDocumentPath(created.unit.id, null);
    const unbound = store.getUnit(created.unit.id);
    expect(unbound?.documentPath).toBeNull();
    expect(unbound?.kind).toBe("free");
    expect(unbound?.content).toEqual(created.unit.content);
    expect(store.getInstance(created.instance.id)).toEqual(created.instance);
  });

  it("renames only the semantic unit definition and preserves synchronized data", async () => {
    const { store, persisted } = createStore();
    await store.load();
    const created = await store.createUnitWithInstance({
      name: "原单位",
      documentPath: "论文阅读笔记/原文.md",
      tags: ["触觉"],
      properties: { status: "reading" },
      owner: "研究项目",
      content,
      instance: {
        canvasPath: "Canvas A.md",
        memberElementIds: { "member-a": "a-1", "member-b": "a-2" },
        origin: { x: 120, y: 240 },
      },
    });
    await store.createSynchronizedInstance({
      unitId: created.unit.id,
      canvasPath: "Canvas B.md",
      memberElementIds: { "member-a": "b-1", "member-b": "b-2" },
      origin: { x: 900, y: 600 },
    });
    const originalUnit = store.getUnit(created.unit.id);
    const originalInstances = store.getInstancesForUnit(created.unit.id);

    await store.renameUnit(created.unit.id, "  新单位  ");

    const renamed = store.getUnit(created.unit.id);
    expect(renamed?.name).toBe("新单位");
    expect(renamed).toEqual({
      ...originalUnit,
      name: "新单位",
      updatedAt: renamed?.updatedAt,
    });
    expect(store.getInstancesForUnit(created.unit.id)).toEqual(originalInstances);
    expect(persisted()?.units[created.unit.id]?.name).toBe("新单位");
  });

  it("rejects empty or duplicate semantic unit names without changing stored data", async () => {
    const { store, persisted } = createStore();
    await store.load();
    const first = await store.createUnit({ name: "第一个单位", content });
    const second = await store.createUnit({ name: "第二个单位", content });
    const before = structuredClone(persisted());

    await expect(store.renameUnit(first.id, "   ")).rejects.toThrow("元素单位名称不能为空");
    await expect(store.renameUnit(first.id, " 第二个单位 ")).rejects.toThrow("已存在");

    expect(store.getUnit(first.id)).toEqual(first);
    expect(store.getUnit(second.id)).toEqual(second);
    expect(persisted()).toEqual(before);
  });

  it("stops stale canonical writes and leaves the current revision intact", async () => {
    const { store } = createStore();
    await store.load();
    const unit = await store.createUnit({ name: "冲突保护", content });
    expect(await store.replaceCanonicalContent(unit.id, 1, content)).toBe(2);
    await expect(store.replaceCanonicalContent(unit.id, 1, content))
      .rejects.toBeInstanceOf(SemanticUnitRevisionConflictError);
    expect(store.getUnit(unit.id)?.revision).toBe(2);
  });

  it("dissolves registration without implying deletion of any live element", async () => {
    const { store } = createStore();
    await store.load();
    const { unit, instance } = await store.createUnitWithInstance({
      name: "可解除单位",
      content,
      instance: {
        canvasPath: "Canvas.md",
        memberElementIds: { "member-a": "visual-a", "member-b": "visual-b" },
        origin: { x: 0, y: 0 },
      },
    });
    await store.dissolveInstance(instance.id);
    expect(store.getInstanceByElement("Canvas.md", "visual-a")).toBeNull();
    expect(store.getUnit(unit.id)).not.toBeNull();
  });

  it("deletes only semantic unit records and all registrations", async () => {
    const { store } = createStore();
    await store.load();
    const { unit } = await store.createUnitWithInstance({
      name: "可删除单位",
      content,
      instance: {
        canvasPath: "Canvas.md",
        memberElementIds: { "member-a": "visual-a", "member-b": "visual-b" },
        origin: { x: 0, y: 0 },
      },
    });
    await store.dissolveUnit(unit.id);
    expect(store.getUnit(unit.id)).toBeNull();
    expect(store.getInstancesForUnit(unit.id)).toEqual([]);
    expect(store.getInstanceByElement("Canvas.md", "visual-a")).toBeNull();
  });

  it("keeps a bounded audit trail of verified backups", async () => {
    const { store } = createStore();
    await store.load();
    const record = {
      id: "backup-1",
      sourcePath: "Canvas.md",
      backupPath: ".obsidian/plugins/knowledge-suite/semantic-unit-backups/Canvas.md.bak",
      sourceHash: "abc",
      backupHash: "abc",
      reason: "create-unit",
      createdAt: new Date().toISOString(),
    };
    await store.recordInitialPluginDataBackup(record);
    await store.recordCanvasBackup(record);
    expect(store.getInitialPluginDataBackup()?.id).toBe("backup-1");
  });
});
