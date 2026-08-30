import { describe, expect, it } from "vitest";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { SemanticUnitInstance } from "../../src/features/semantic-units/types";
import {
  appendSemanticUnitMembers,
  captureSemanticUnitInstance,
  createSemanticUnitSnapshot,
  materializeSemanticUnitContent,
  reconcileSemanticUnitInstance,
  removeSemanticUnitMembers,
  repairSemanticUnitInstanceMapping,
  semanticUnitContentFingerprint,
} from "../../src/features/semantic-units/snapshot";

describe("semantic unit snapshots", () => {
  it("normalizes positions and remaps internal bindings without changing live elements", () => {
    const elements = [
      { id: "shape", type: "rectangle", x: 100, y: 80, width: 200, height: 100, groupIds: [], boundElements: [{ id: "text", type: "text" }], isDeleted: false },
      { id: "text", type: "text", x: 130, y: 110, width: 80, height: 30, groupIds: [], containerId: "shape", isDeleted: false },
    ] as unknown as ExcalidrawElement[];
    const snapshot = createSemanticUnitSnapshot(elements, {});
    const shape = snapshot.content.members[0];
    const text = snapshot.content.members[1];

    expect(shape.element.x).toBe(0);
    expect(text.element.x).toBe(30);
    expect(text.element.containerId).toBe(shape.memberId);
    expect((shape.element.boundElements as Array<{ id: string }>)[0].id).toBe(text.memberId);
    expect(elements[0].id).toBe("shape");
    expect(snapshot.memberElementIds[shape.memberId]).toBe("shape");
  });

  it("adds and removes semantic members without mutating live canvas elements", () => {
    const original = [
      { id: "first", type: "rectangle", x: 100, y: 100, width: 80, height: 40, groupIds: [], isDeleted: false },
    ] as unknown as ExcalidrawElement[];
    const created = createSemanticUnitSnapshot(original, {});
    const addedElement = {
      id: "second",
      type: "text",
      x: 220,
      y: 130,
      width: 60,
      height: 24,
      groupIds: [],
      isDeleted: false,
    } as unknown as ExcalidrawElement;
    const appended = appendSemanticUnitMembers(
      created.content,
      created.memberElementIds,
      created.origin,
      [addedElement],
      {},
    );
    expect(appended.content.members).toHaveLength(2);
    expect(addedElement.x).toBe(220);
    const removed = removeSemanticUnitMembers(
      appended.content,
      appended.memberElementIds,
      new Set(["second"]),
    );
    expect(removed.content.members).toHaveLength(1);
    expect(Object.values(removed.memberElementIds)).toEqual(["first"]);
  });

  it("captures selected image assets and fails closed when an asset is unavailable", () => {
    const image = {
      id: "image",
      type: "image",
      fileId: "asset-1",
      x: 20,
      y: 40,
      width: 300,
      height: 180,
      groupIds: [],
      isDeleted: false,
    } as unknown as ExcalidrawElement;
    const file = {
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AAAA",
      created: 123,
    } as never;

    const snapshot = createSemanticUnitSnapshot([image], { "asset-1": file });
    expect(snapshot.content.assets["asset-1"]).toEqual({
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AAAA",
      created: 123,
    });
    expect(() => createSemanticUnitSnapshot([image], {}))
      .toThrow("无法读取选中的图片或文件节点资源");
  });
});

describe("semantic unit materialization", () => {
  it("creates fresh live IDs while preserving layout, bindings and image assets", () => {
    const result = materializeSemanticUnitContent({
      bounds: { x: 0, y: 0, width: 180, height: 80 },
      members: [
        {
          memberId: "member-box",
          element: {
            id: "member-box",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            groupIds: ["canonical-group"],
            boundElements: [{ id: "member-label", type: "text" }],
          },
        },
        {
          memberId: "member-label",
          element: {
            id: "member-label",
            type: "text",
            x: 20,
            y: 20,
            width: 60,
            height: 30,
            groupIds: ["canonical-group"],
            containerId: "member-box",
          },
        },
        {
          memberId: "member-image",
          element: {
            id: "member-image",
            type: "image",
            x: 120,
            y: 10,
            width: 60,
            height: 60,
            groupIds: [],
            fileId: "source-file",
          },
        },
      ],
      assets: {
        "source-file": {
          mimeType: "image/png",
          dataURL: "data:image/png;base64,AA==",
          created: 10,
        },
      },
    }, { x: 500, y: 300 });

    expect(result.elements).toHaveLength(3);
    expect(result.files).toHaveLength(1);
    expect(result.memberElementIds["member-box"]).not.toBe("member-box");
    expect(result.memberElementIds["member-box"]).toHaveLength(8);
    const box = result.elements.find((element) => element.type === "rectangle") as any;
    const label = result.elements.find((element) => element.type === "text") as any;
    const image = result.elements.find((element) => element.type === "image") as any;
    expect([box.x, box.y, label.x, label.y, image.x, image.y]).toEqual([500, 300, 520, 320, 620, 310]);
    expect(label.containerId).toBe(box.id);
    expect(box.boundElements[0].id).toBe(label.id);
    expect(label.groupIds[0]).toBe(box.groupIds[0]);
    expect(image.fileId).toBe(result.files[0].id);
    expect(result.files[0].dataURL).toBe("data:image/png;base64,AA==");
  });

  it("fails closed when a referenced image asset is missing", () => {
    expect(() => materializeSemanticUnitContent({
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      members: [{
        memberId: "member-image",
        element: {
          id: "member-image",
          type: "image",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          groupIds: [],
          fileId: "missing-file",
        },
      }],
      assets: {},
    }, { x: 0, y: 0 })).toThrow("图片资源不完整");
  });
});

describe("semantic unit synchronization", () => {
  const content = {
    bounds: { x: 0, y: 0, width: 270, height: 80 },
    members: [
      {
        memberId: "member-shape",
        element: { id: "member-shape", type: "rectangle", x: 0, y: 0, width: 100, height: 80, groupIds: [] },
      },
      {
        memberId: "member-text",
        element: { id: "member-text", type: "text", x: 150, y: 30, width: 120, height: 40, text: "同步文字", groupIds: [] },
      },
    ],
    assets: {},
  };
  const instance = {
    id: "instance-test",
    unitId: "unit-test",
    canvasPath: "Canvas B.md",
    memberElementIds: { "member-shape": "shape-old", "member-text": "text-old" },
    origin: { x: 500, y: 300 },
    appliedRevision: 1,
    state: { locked: false, hidden: false },
    missingMemberIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as SemanticUnitInstance;

  it("repairs a text ID rewritten by Markdown save without claiming unrelated copies", () => {
    const scene = [
      { id: "shape-old", type: "rectangle", x: 500, y: 300, width: 100, height: 80, groupIds: [], isDeleted: false },
      { id: "newText1", type: "text", x: 900, y: 500, width: 120, height: 40, text: "同步文字", groupIds: [], isDeleted: false },
      { id: "copyText", type: "text", x: 4000, y: 4000, width: 120, height: 40, text: "同步文字", groupIds: [], isDeleted: false },
    ] as unknown as ExcalidrawElement[];
    const repaired = repairSemanticUnitInstanceMapping(content, instance, scene);
    expect(repaired.memberElementIds).toEqual({
      "member-shape": "shape-old",
      "member-text": "newText1",
    });
    expect(repaired.memberElementIds["member-text"]).not.toBe("copyText");
  });

  it("reports no matches after the whole visual instance is deleted", () => {
    const repaired = repairSemanticUnitInstanceMapping(content, instance, []);
    expect(repaired.matchedMemberIds).toEqual([]);
    expect(repaired.missingMemberIds).toEqual(["member-shape", "member-text"]);
  });

  it("does not adopt an ordinary nearby copy for a newly added canonical member", () => {
    const expanded = structuredClone(content);
    expanded.members.push({
      memberId: "member-new",
      element: { id: "member-new", type: "text", x: 300, y: 100, width: 100, height: 40, text: "新增内容", groupIds: [] },
    });
    const scene = [
      { id: "shape-old", type: "rectangle", x: 500, y: 300, width: 100, height: 80, groupIds: [], isDeleted: false },
      { id: "text-old", type: "text", x: 650, y: 330, width: 120, height: 40, text: "同步文字", groupIds: [], isDeleted: false },
      { id: "ordinary-copy", type: "text", x: 800, y: 400, width: 100, height: 40, text: "新增内容", groupIds: [], isDeleted: false },
    ] as unknown as ExcalidrawElement[];
    const repaired = repairSemanticUnitInstanceMapping(expanded, instance, scene);
    expect(repaired.memberElementIds["member-new"]).toBeUndefined();
  });

  it("treats a shared translation as instance movement rather than canonical layout change", () => {
    const scene = [
      { id: "shape-old", type: "rectangle", x: 800, y: 500, width: 100, height: 80, groupIds: [], isDeleted: false },
      { id: "text-old", type: "text", x: 950, y: 530, width: 120, height: 40, text: "同步文字", groupIds: [], isDeleted: false },
    ] as unknown as ExcalidrawElement[];
    const captured = captureSemanticUnitInstance(content, instance, scene, {});
    expect(captured?.origin).toEqual({ x: 800, y: 500 });
    expect(semanticUnitContentFingerprint(captured!.content)).toBe(semanticUnitContentFingerprint(content));
  });

  it("reconciles canonical edits at the target instance origin", () => {
    const edited = structuredClone(content);
    edited.members[1].element.x = 300;
    edited.members[1].element.text = "修改后的文字";
    const scene = [
      { id: "shape-old", type: "rectangle", x: 500, y: 300, width: 100, height: 80, groupIds: [], isDeleted: false, version: 1 },
      { id: "text-old", type: "text", x: 650, y: 330, width: 120, height: 40, text: "同步文字", groupIds: [], isDeleted: false, version: 1 },
    ] as unknown as ExcalidrawElement[];
    const reconciled = reconcileSemanticUnitInstance(edited, instance, scene);
    const text = reconciled.elements.find((element) => element.id === "text-old") as any;
    expect(text.x).toBe(800);
    expect(text.text).toBe("修改后的文字");
    expect(reconciled.memberElementIds["member-text"]).toBe("text-old");
  });
});
