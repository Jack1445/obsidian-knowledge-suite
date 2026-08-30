import { customAlphabet, nanoid } from "nanoid";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { BinaryFiles } from "@zsviczian/excalidraw/types/excalidraw/types";
import type {
  SemanticUnitContentSnapshot,
  SemanticUnitJsonObject,
} from "./types";
import type { SemanticUnitInstance } from "./types";

export type CreatedSemanticUnitSnapshot = {
  content: SemanticUnitContentSnapshot;
  memberElementIds: Record<string, string>;
  origin: { x: number; y: number };
};

export type MaterializedSemanticUnitContent = {
  elements: ExcalidrawElement[];
  files: Array<{
    id: string;
    mimeType: string;
    dataURL: string;
    created: number;
  }>;
  memberElementIds: Record<string, string>;
};

const createFileId = customAlphabet("1234567890abcdef", 40);

const SCENE_ONLY_ELEMENT_KEYS = new Set([
  "index",
  "version",
  "versionNonce",
  "updated",
]);

const canonicalElement = (element: SemanticUnitJsonObject): SemanticUnitJsonObject => {
  const clone = structuredClone(element);
  for (const key of SCENE_ONLY_ELEMENT_KEYS) delete clone[key];
  clone.isDeleted = false;
  return clone;
};

const stableJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableJsonValue(child)]));
};

export const semanticUnitContentFingerprint = (
  content: SemanticUnitContentSnapshot,
): string => JSON.stringify(stableJsonValue({
  bounds: content.bounds,
  members: [...content.members]
    .sort((left, right) => left.memberId.localeCompare(right.memberId))
    .map((member) => ({
      memberId: member.memberId,
      element: canonicalElement(member.element),
    })),
  assets: Object.fromEntries(Object.entries(content.assets).sort(([left], [right]) =>
    left.localeCompare(right),
  )),
}));

const remapElementReferences = (
  value: Record<string, unknown>,
  idMap: Map<string, string>,
  groupMap: Map<string, string>,
): void => {
  if (typeof value.id === "string") value.id = idMap.get(value.id) ?? value.id;
  if (typeof value.containerId === "string") value.containerId = idMap.get(value.containerId) ?? null;
  if (typeof value.frameId === "string") value.frameId = idMap.get(value.frameId) ?? null;
  if (Array.isArray(value.groupIds)) {
    const groupIds: unknown[] = value.groupIds;
    value.groupIds = groupIds.map((id) =>
      typeof id === "string" ? groupMap.get(id) ?? id : id,
    );
  }
  if (Array.isArray(value.boundElements)) {
    const boundElements: unknown[] = value.boundElements;
    value.boundElements = boundElements
      .map((bound) => {
        if (!bound || typeof bound !== "object") return null;
        const record = bound as Record<string, unknown>;
        return typeof record.id === "string" && idMap.has(record.id)
          ? { ...record, id: idMap.get(record.id) }
          : null;
      })
      .filter(Boolean);
  }
  for (const key of ["startBinding", "endBinding"] as const) {
    const binding = value[key];
    if (!binding || typeof binding !== "object") continue;
    const record = binding as Record<string, unknown>;
    if (typeof record.elementId === "string") {
      value[key] = idMap.has(record.elementId)
        ? { ...record, elementId: idMap.get(record.elementId) }
        : null;
    }
  }
};

export const createSemanticUnitSnapshot = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): CreatedSemanticUnitSnapshot => {
  const selected = elements.filter((element) => !element.isDeleted);
  if (selected.length === 0) throw new Error("至少选择一个画布元素。");
  const minX = Math.min(...selected.map((element) => element.x));
  const minY = Math.min(...selected.map((element) => element.y));
  const maxX = Math.max(...selected.map((element) => element.x + element.width));
  const maxY = Math.max(...selected.map((element) => element.y + element.height));
  const idMap = new Map(selected.map((element) => [element.id, `member-${nanoid()}`]));
  const groupMap = new Map<string, string>();
  for (const element of selected) {
    for (const groupId of element.groupIds ?? []) {
      if (!groupMap.has(groupId)) groupMap.set(groupId, `group-${nanoid()}`);
    }
  }
  const memberElementIds: Record<string, string> = {};
  const members = selected.map((element) => {
    const memberId = idMap.get(element.id);
    if (!memberId) throw new Error("无法建立稳定的语义成员标识。");
    memberElementIds[memberId] = element.id;
    const parsed = JSON.parse(JSON.stringify(element)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("无法复制所选画布元素。");
    }
    const cloned = parsed as Record<string, unknown>;
    remapElementReferences(cloned, idMap, groupMap);
    cloned.x = element.x - minX;
    cloned.y = element.y - minY;
    return { memberId, element: cloned as SemanticUnitJsonObject };
  });
  const assets: SemanticUnitContentSnapshot["assets"] = {};
  for (const element of selected) {
    if (element.type !== "image" || !element.fileId) continue;
    const file = files[element.fileId];
    if (!file) {
      throw new Error("无法读取选中的图片或文件节点资源，请等待画布加载完成后重试。");
    }
    assets[element.fileId] = {
      mimeType: String(file.mimeType),
      dataURL: String(file.dataURL),
      created: typeof file.created === "number" ? file.created : undefined,
    };
  }
  return {
    content: {
      bounds: { x: 0, y: 0, width: maxX - minX, height: maxY - minY },
      members,
      assets,
    },
    memberElementIds,
    origin: { x: minX, y: minY },
  };
};

export const materializeSemanticUnitContent = (
  content: SemanticUnitContentSnapshot,
  origin: { x: number; y: number },
): MaterializedSemanticUnitContent => {
  if (content.members.length === 0) throw new Error("元素单位没有可引入的成员。");
  const elementIdMap = new Map(content.members.map((member) => [member.memberId, nanoid(8)]));
  const groupIdMap = new Map<string, string>();
  const fileIdMap = new Map<string, string>();
  const memberElementIds: Record<string, string> = {};
  const elements = content.members.map((member) => {
    const parsed = JSON.parse(JSON.stringify(member.element)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("元素单位包含无法恢复的画布成员。");
    }
    const element = parsed as Record<string, unknown>;
    const liveId = elementIdMap.get(member.memberId);
    if (!liveId) throw new Error("无法建立实例成员标识。");
    memberElementIds[member.memberId] = liveId;
    for (const groupId of Array.isArray(element.groupIds) ? element.groupIds : []) {
      if (typeof groupId === "string" && !groupIdMap.has(groupId)) {
        groupIdMap.set(groupId, nanoid());
      }
    }
    remapElementReferences(element, elementIdMap, groupIdMap);
    element.id = liveId;
    element.x = (typeof element.x === "number" ? element.x : 0) + origin.x;
    element.y = (typeof element.y === "number" ? element.y : 0) + origin.y;
    element.isDeleted = false;
    element.updated = Date.now();
    if (typeof element.fileId === "string") {
      const sourceFileId = element.fileId;
      if (!fileIdMap.has(sourceFileId)) fileIdMap.set(sourceFileId, createFileId());
      element.fileId = fileIdMap.get(sourceFileId) ?? null;
    }
    return element as unknown as ExcalidrawElement;
  });
  const files: MaterializedSemanticUnitContent["files"] = [];
  for (const [sourceFileId, targetFileId] of fileIdMap) {
    const asset = content.assets[sourceFileId];
    if (!asset?.dataURL) {
      throw new Error("元素单位的图片资源不完整，已停止引入。");
    }
    files.push({
      id: targetFileId,
      mimeType: asset.mimeType,
      dataURL: asset.dataURL,
      created: asset.created ?? Date.now(),
    });
  }
  return { elements, files, memberElementIds };
};

export type CapturedSemanticUnitInstance = {
  content: SemanticUnitContentSnapshot;
  memberElementIds: Record<string, string>;
  missingMemberIds: string[];
  origin: { x: number; y: number };
};

export type RepairedSemanticUnitInstanceMapping = {
  memberElementIds: Record<string, string>;
  matchedMemberIds: string[];
  missingMemberIds: string[];
};

const elementText = (element: Record<string, unknown>): string | null => {
  for (const key of ["text", "rawText", "originalText"]) {
    if (typeof element[key] === "string") return element[key];
  }
  return null;
};

export const repairSemanticUnitInstanceMapping = (
  canonical: SemanticUnitContentSnapshot,
  instance: SemanticUnitInstance,
  sceneElements: readonly ExcalidrawElement[],
  claimedElementIds: ReadonlySet<string> = new Set(),
): RepairedSemanticUnitInstanceMapping => {
  const liveElements = sceneElements.filter((element) => !element.isDeleted);
  const liveById = new Map(liveElements.map((element) => [element.id, element]));
  const repaired: Record<string, string> = {};
  const used = new Set<string>();
  for (const member of canonical.members) {
    const mappedId = instance.memberElementIds[member.memberId];
    if (mappedId && liveById.has(mappedId)) {
      repaired[member.memberId] = mappedId;
      used.add(mappedId);
    }
  }
  // Never reconstruct an instance from visual similarity alone. At least one
  // explicitly registered live member must still anchor the instance. This
  // keeps ordinary copies unrelated and makes full visual deletion dissolve
  // the registration instead of adopting nearby lookalikes.
  if (used.size === 0) {
    return {
      memberElementIds: {},
      matchedMemberIds: [],
      missingMemberIds: canonical.members.map((member) => member.memberId),
    };
  }
  const distanceLimit = Math.max(240, Math.hypot(canonical.bounds.width, canonical.bounds.height) * 1.25);
  for (const member of canonical.members) {
    if (repaired[member.memberId]) continue;
    // A canonical member absent from this instance's registry is a genuinely
    // new synchronized member. It must be materialized, never "repaired" by
    // adopting an unrelated nearby element or an ordinary Ctrl+C/V copy.
    if (!Object.hasOwn(instance.memberElementIds, member.memberId)) continue;
    // The compatibility repair is deliberately restricted to text nodes:
    // Excalidraw Markdown rewrites their IDs to block IDs during save. Other
    // missing element types represent real removal and must not be inferred.
    if (member.element.type !== "text") continue;
    const expectedX = instance.origin.x + numberValue(member.element.x);
    const expectedY = instance.origin.y + numberValue(member.element.y);
    const expectedType = member.element.type;
    const expectedText = elementText(member.element);
    const expectedWidth = numberValue(member.element.width);
    const expectedHeight = numberValue(member.element.height);
    const candidates = liveElements
      .filter((element) =>
        !used.has(element.id) &&
        !claimedElementIds.has(element.id) &&
        element.type === expectedType &&
        (expectedText === null || elementText(element as unknown as Record<string, unknown>) === expectedText),
      )
      .map((element) => {
        const distance = Math.hypot(element.x - expectedX, element.y - expectedY);
        const sizeDelta = Math.abs(element.width - expectedWidth) + Math.abs(element.height - expectedHeight);
        return { element, distance, score: distance + sizeDelta * 0.2 };
      })
      .filter((candidate) => candidate.distance <= distanceLimit)
      .sort((left, right) => left.score - right.score);
    const match = candidates[0]?.element;
    if (!match) continue;
    repaired[member.memberId] = match.id;
    used.add(match.id);
  }
  const matchedMemberIds = Object.keys(repaired);
  return {
    memberElementIds: repaired,
    matchedMemberIds,
    missingMemberIds: canonical.members
      .map((member) => member.memberId)
      .filter((memberId) => !repaired[memberId]),
  };
};

export const captureSemanticUnitInstance = (
  canonical: SemanticUnitContentSnapshot,
  instance: SemanticUnitInstance,
  sceneElements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): CapturedSemanticUnitInstance | null => {
  const liveById = new Map(sceneElements
    .filter((element) => !element.isDeleted)
    .map((element) => [element.id, element]));
  const canonicalByMember = new Map(canonical.members.map((member) => [member.memberId, member]));
  const presentEntries = Object.entries(instance.memberElementIds)
    .map(([memberId, elementId]) => ({ memberId, elementId, element: liveById.get(elementId) }))
    .filter((entry): entry is { memberId: string; elementId: string; element: ExcalidrawElement } =>
      Boolean(entry.element && canonicalByMember.has(entry.memberId)),
    );
  if (presentEntries.length === 0) return null;
  const missingMemberIds = Object.keys(instance.memberElementIds)
    .filter((memberId) => !presentEntries.some((entry) => entry.memberId === memberId));

  const translationCandidates = presentEntries.map(({ memberId, element }) => {
    const previous = canonicalByMember.get(memberId)?.element;
    return {
      x: element.x - instance.origin.x - numberValue(previous?.x),
      y: element.y - instance.origin.y - numberValue(previous?.y),
    };
  });
  const firstTranslation = translationCandidates[0];
  const hasSharedTranslation = missingMemberIds.length === 0 && translationCandidates.every((value) =>
    Math.abs(value.x - firstTranslation.x) < 0.1 &&
    Math.abs(value.y - firstTranslation.y) < 0.1,
  );
  const nextOrigin = hasSharedTranslation
    ? {
      x: instance.origin.x + firstTranslation.x,
      y: instance.origin.y + firstTranslation.y,
    }
    : { ...instance.origin };

  const elementIdMap = new Map(Object.entries(instance.memberElementIds)
    .map(([memberId, elementId]) => [elementId, memberId]));
  const groupIdMap = new Map<string, string>();
  const fileIdMap = new Map<string, string>();
  for (const { memberId, element } of presentEntries) {
    const previous = canonicalByMember.get(memberId)?.element;
    const previousGroups = Array.isArray(previous?.groupIds) ? previous.groupIds : [];
    const liveGroups = element.groupIds ?? [];
    for (let index = 0; index < Math.min(previousGroups.length, liveGroups.length); index += 1) {
      const canonicalGroup = previousGroups[index];
      if (typeof canonicalGroup === "string") groupIdMap.set(liveGroups[index], canonicalGroup);
    }
    if (
      element.type === "image" && element.fileId &&
      typeof previous?.fileId === "string"
    ) {
      fileIdMap.set(element.fileId, previous.fileId);
    }
  }
  for (const { element } of presentEntries) {
    for (const liveGroupId of element.groupIds ?? []) {
      if (!groupIdMap.has(liveGroupId)) groupIdMap.set(liveGroupId, `group-${nanoid()}`);
    }
  }

  const assets: SemanticUnitContentSnapshot["assets"] = {};
  const memberElementIds: Record<string, string> = {};
  const members = presentEntries.map(({ memberId, elementId, element }) => {
    memberElementIds[memberId] = elementId;
    const parsed = JSON.parse(JSON.stringify(element)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("无法读取同步实例成员。");
    }
    const cloned = parsed as Record<string, unknown>;
    remapElementReferences(cloned, elementIdMap, groupIdMap);
    cloned.id = memberId;
    cloned.x = element.x - nextOrigin.x;
    cloned.y = element.y - nextOrigin.y;
    if (element.type === "image" && element.fileId) {
      const canonicalFileId = fileIdMap.get(element.fileId) ?? element.fileId;
      const file = files[element.fileId];
      if (!file) throw new Error("无法读取同步实例中的图片资源。");
      cloned.fileId = canonicalFileId;
      assets[canonicalFileId] = {
        mimeType: String(file.mimeType),
        dataURL: String(file.dataURL),
        created: file.created,
      };
    }
    return { memberId, element: canonicalElement(cloned as SemanticUnitJsonObject) };
  });
  return {
    content: {
      bounds: boundsForMembers(members),
      members,
      assets,
    },
    memberElementIds,
    missingMemberIds,
    origin: nextOrigin,
  };
};

export type ReconciledSemanticUnitInstance = MaterializedSemanticUnitContent & {
  removedElements: ExcalidrawElement[];
};

export const reconcileSemanticUnitInstance = (
  canonical: SemanticUnitContentSnapshot,
  instance: SemanticUnitInstance,
  sceneElements: readonly ExcalidrawElement[],
): ReconciledSemanticUnitInstance => {
  const currentById = new Map(sceneElements.map((element) => [element.id, element]));
  const elementIdMap = new Map<string, string>();
  for (const member of canonical.members) {
    elementIdMap.set(member.memberId, instance.memberElementIds[member.memberId] ?? nanoid(8));
  }
  const groupIdMap = new Map<string, string>();
  const fileIdMap = new Map<string, string>();
  for (const member of canonical.members) {
    const current = currentById.get(instance.memberElementIds[member.memberId]);
    const canonicalGroups = Array.isArray(member.element.groupIds) ? member.element.groupIds : [];
    const currentGroups = current?.groupIds ?? [];
    for (let index = 0; index < Math.min(canonicalGroups.length, currentGroups.length); index += 1) {
      const canonicalGroup = canonicalGroups[index];
      if (typeof canonicalGroup === "string") groupIdMap.set(canonicalGroup, currentGroups[index]);
    }
    if (
      current?.type === "image" && current.fileId &&
      typeof member.element.fileId === "string"
    ) {
      fileIdMap.set(member.element.fileId, current.fileId);
    }
  }
  for (const member of canonical.members) {
    for (const canonicalGroupId of Array.isArray(member.element.groupIds) ? member.element.groupIds : []) {
      if (typeof canonicalGroupId === "string" && !groupIdMap.has(canonicalGroupId)) {
        groupIdMap.set(canonicalGroupId, nanoid());
      }
    }
    if (typeof member.element.fileId === "string" && !fileIdMap.has(member.element.fileId)) {
      fileIdMap.set(member.element.fileId, createFileId());
    }
  }

  const memberElementIds: Record<string, string> = {};
  const elements = canonical.members.map((member) => {
    const parsed = JSON.parse(JSON.stringify(member.element)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("元素单位包含无法同步的成员。");
    }
    const element = parsed as Record<string, unknown>;
    const liveId = elementIdMap.get(member.memberId);
    if (!liveId) throw new Error("无法建立同步成员标识。");
    const current = currentById.get(instance.memberElementIds[member.memberId]);
    memberElementIds[member.memberId] = liveId;
    remapElementReferences(element, elementIdMap, groupIdMap);
    element.id = liveId;
    element.x = (typeof element.x === "number" ? element.x : 0) + instance.origin.x;
    element.y = (typeof element.y === "number" ? element.y : 0) + instance.origin.y;
    element.isDeleted = false;
    element.updated = Date.now();
    element.version = current ? current.version + 1 : 1;
    element.versionNonce = Math.floor(Math.random() * 2 ** 31);
    if (current?.index) element.index = current.index;
    if (typeof element.fileId === "string") element.fileId = fileIdMap.get(element.fileId) ?? null;
    return element as unknown as ExcalidrawElement;
  });
  const retainedMemberIds = new Set(canonical.members.map((member) => member.memberId));
  const removedElements = Object.entries(instance.memberElementIds)
    .filter(([memberId]) => !retainedMemberIds.has(memberId))
    .map(([, elementId]) => currentById.get(elementId))
    .filter((element): element is ExcalidrawElement => Boolean(element))
    .map((element) => ({
      ...element,
      isDeleted: true,
      version: element.version + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    }));
  const files: MaterializedSemanticUnitContent["files"] = [];
  for (const [canonicalFileId, liveFileId] of fileIdMap) {
    const asset = canonical.assets[canonicalFileId];
    if (!asset?.dataURL) throw new Error("同步内容的图片资源不完整。");
    files.push({
      id: liveFileId,
      mimeType: asset.mimeType,
      dataURL: asset.dataURL,
      created: asset.created ?? Date.now(),
    });
  }
  return { elements, removedElements, files, memberElementIds };
};

const numberValue = (value: SemanticUnitJsonObject[string]): number =>
  typeof value === "number" ? value : 0;

const boundsForMembers = (
  members: SemanticUnitContentSnapshot["members"],
): SemanticUnitContentSnapshot["bounds"] => {
  const minX = Math.min(...members.map((member) => numberValue(member.element.x)));
  const minY = Math.min(...members.map((member) => numberValue(member.element.y)));
  const maxX = Math.max(...members.map((member) =>
    numberValue(member.element.x) + numberValue(member.element.width),
  ));
  const maxY = Math.max(...members.map((member) =>
    numberValue(member.element.y) + numberValue(member.element.height),
  ));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const appendSemanticUnitMembers = (
  content: SemanticUnitContentSnapshot,
  memberElementIds: Record<string, string>,
  origin: { x: number; y: number },
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): { content: SemanticUnitContentSnapshot; memberElementIds: Record<string, string> } => {
  const registeredIds = new Set(Object.values(memberElementIds));
  const additions = elements.filter((element) => !element.isDeleted && !registeredIds.has(element.id));
  if (additions.length === 0) throw new Error("没有可纳入的新增画布元素。");
  const idMap = new Map(Object.entries(memberElementIds).map(([memberId, elementId]) => [elementId, memberId]));
  for (const element of additions) idMap.set(element.id, `member-${nanoid()}`);
  const groupMap = new Map<string, string>();
  const nextMap = { ...memberElementIds };
  const appended = additions.map((element) => {
    const memberId = idMap.get(element.id);
    if (!memberId) throw new Error("无法建立稳定的语义成员标识。");
    nextMap[memberId] = element.id;
    const parsed = JSON.parse(JSON.stringify(element)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("无法复制所选画布元素。");
    }
    const cloned = parsed as Record<string, unknown>;
    remapElementReferences(cloned, idMap, groupMap);
    cloned.x = element.x - origin.x;
    cloned.y = element.y - origin.y;
    return { memberId, element: cloned as SemanticUnitJsonObject };
  });
  const assets = { ...content.assets };
  for (const element of additions) {
    if (element.type !== "image" || !element.fileId) continue;
    const file = files[element.fileId];
    if (!file) {
      throw new Error("无法读取选中的图片或文件节点资源，请等待画布加载完成后重试。");
    }
    assets[element.fileId] = {
      mimeType: String(file.mimeType),
      dataURL: String(file.dataURL),
      created: typeof file.created === "number" ? file.created : undefined,
    };
  }
  const members = [...structuredClone(content.members), ...appended];
  return {
    content: { bounds: boundsForMembers(members), members, assets },
    memberElementIds: nextMap,
  };
};

export const removeSemanticUnitMembers = (
  content: SemanticUnitContentSnapshot,
  memberElementIds: Record<string, string>,
  elementIds: ReadonlySet<string>,
): { content: SemanticUnitContentSnapshot; memberElementIds: Record<string, string> } => {
  const removedMemberIds = new Set(Object.entries(memberElementIds)
    .filter(([, elementId]) => elementIds.has(elementId))
    .map(([memberId]) => memberId));
  if (removedMemberIds.size === 0) throw new Error("所选内容不属于当前元素单位。");
  const members = structuredClone(content.members)
    .filter((member) => !removedMemberIds.has(member.memberId));
  if (members.length === 0) throw new Error("元素单位至少需要保留一个成员；如不再需要请解除单位实例。");
  const keptIds = new Map(members.map((member) => [member.memberId, member.memberId]));
  for (const member of members) {
    remapElementReferences(member.element, keptIds, new Map());
  }
  const nextMap = Object.fromEntries(Object.entries(memberElementIds)
    .filter(([memberId]) => !removedMemberIds.has(memberId)));
  return {
    content: { ...structuredClone(content), bounds: boundsForMembers(members), members },
    memberElementIds: nextMap,
  };
};
