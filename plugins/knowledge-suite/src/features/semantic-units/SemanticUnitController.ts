import type ExcalidrawPlugin from "../../core/main";
import type { KnowledgeSuiteDataNamespace } from "../../core/KnowledgeSuiteDataCoordinator";
import { SemanticUnitSafetyService } from "./SemanticUnitSafetyService";
import { SemanticUnitStore } from "./SemanticUnitStore";
import type {
  SemanticUnitContentSnapshot,
  SemanticUnitInstance,
  SemanticUnitsData,
} from "./types";
import { Menu, Notice } from "obsidian";
import type ExcalidrawView from "../../view/ExcalidrawView";
import { SemanticUnitCreateModal } from "./SemanticUnitCreateModal";
import {
  captureSemanticUnitInstance,
  createSemanticUnitSnapshot,
  materializeSemanticUnitContent,
  reconcileSemanticUnitInstance,
  repairSemanticUnitInstanceMapping,
  semanticUnitContentFingerprint,
} from "./snapshot";
import { appendSemanticUnitMembers, removeSemanticUnitMembers } from "./snapshot";
import {
  sceneCoordsToViewportCoords,
  VIEW_TYPE_EXCALIDRAW,
} from "../../constants/constants";
import { setStyle } from "../../utils/styleUtils";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type {
  BinaryFileData,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  SemanticUnitImportModal,
  type SemanticUnitImportMode,
} from "./SemanticUnitImportModal";
import { getExcalidrawViews } from "../../utils/obsidianUtils";
import { CanvasReadySyncScheduler } from "./CanvasReadySyncScheduler";
import { CanvasSaveSyncCoordinator } from "./CanvasSaveSyncCoordinator";

export default class SemanticUnitController {
  public readonly store: SemanticUnitStore;
  public readonly safety: SemanticUnitSafetyService;
  private readonly sceneChangeTimers = new WeakMap<ExcalidrawView, number>();
  private readonly canvasReadySync: CanvasReadySyncScheduler<ExcalidrawView>;
  private readonly canvasSaveSync: CanvasSaveSyncCoordinator<ExcalidrawView>;
  private readonly suppressSceneChangesUntil = new WeakMap<ExcalidrawView, number>();
  private readonly processingViews = new WeakSet<ExcalidrawView>();
  private readonly transientOverlayDismissers = new WeakMap<ExcalidrawView, () => void>();
  private readonly stateOverlayRoots = new WeakMap<ExcalidrawView, HTMLElement>();
  private readonly stateOverlayFrames = new WeakMap<ExcalidrawView, number>();

  constructor(
    public readonly host: ExcalidrawPlugin,
    persistence: KnowledgeSuiteDataNamespace<SemanticUnitsData>,
  ) {
    this.store = new SemanticUnitStore(persistence);
    this.safety = new SemanticUnitSafetyService(host.app);
    this.canvasReadySync = new CanvasReadySyncScheduler(
      async (view) => {
        const processed = await this.processViewChanges(view, true);
        this.scheduleInstanceStateOverlayRefresh(view);
        return processed;
      },
      (error) => console.error("Unable to synchronize semantic units on canvas open", error),
    );
    this.canvasSaveSync = new CanvasSaveSyncCoordinator(
      (view) => this.processingViews.has(view),
      (view) => {
        if ((this.suppressSceneChangesUntil.get(view) ?? 0) > Date.now()) {
          return Promise.resolve(true);
        }
        return this.processViewChanges(view, false, true);
      },
    );
  }

  public async initialize(): Promise<void> {
    await this.store.load();
    this.host.registerEvent(this.host.app.workspace.on("active-leaf-change", (leaf) => {
      const view = leaf?.view;
      if (view?.getViewType() === VIEW_TYPE_EXCALIDRAW) {
        this.handleCanvasReady(view as ExcalidrawView);
      }
    }));
  }

  public handleCanvasReady(view: ExcalidrawView): void {
    const ownerWindow = view.ownerWindow ?? window;
    this.canvasReadySync.start(view, ownerWindow);
    this.scheduleInstanceStateOverlayRefresh(view);
  }

  public handleSceneChange(view: ExcalidrawView): void {
    this.scheduleInstanceStateOverlayRefresh(view);
    if ((this.suppressSceneChangesUntil.get(view) ?? 0) > Date.now()) return;
    const ownerWindow = view.ownerWindow ?? window;
    const previous = this.sceneChangeTimers.get(view);
    if (previous) ownerWindow.clearTimeout(previous);
    const timer = ownerWindow.setTimeout(() => {
      this.sceneChangeTimers.delete(view);
      void this.processViewChanges(view, false).catch((error: unknown) => {
        console.error("Unable to capture semantic unit changes", error);
        new Notice(error instanceof Error ? error.message : "无法同步元素单位修改。");
      });
    }, 900);
    this.sceneChangeTimers.set(view, timer);
  }

  public isProcessingView(view: ExcalidrawView): boolean {
    return this.processingViews.has(view);
  }

  public async handleCanvasSaved(view: ExcalidrawView): Promise<void> {
    const ownerWindow = view.ownerWindow ?? window;
    const pending = this.sceneChangeTimers.get(view);
    if (pending !== undefined) {
      ownerWindow.clearTimeout(pending);
      this.sceneChangeTimers.delete(view);
    }
    await this.canvasSaveSync.flush(view, ownerWindow);
  }

  public openCreateFromSelection(view: ExcalidrawView): void {
    const selected = view.getViewSelectedElements();
    if (selected.length === 0) {
      new Notice("请先选择要纳入语义单位的画布元素。");
      return;
    }
    const canvasPath = view.file?.path;
    const files = { ...(view.excalidrawAPI?.getFiles() ?? {}) };
    if (!canvasPath) {
      new Notice("无法识别当前画布，请重新打开画布后再试。");
      return;
    }
    let snapshot: ReturnType<typeof createSemanticUnitSnapshot>;
    try {
      // Capture the complete read-only selection while the originating canvas
      // view is still alive. The modal may outlive or detach that view.
      snapshot = createSemanticUnitSnapshot(selected, files);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "无法读取所选画布内容。");
      return;
    }
    new SemanticUnitCreateModal(
      this.host.app,
      (file) => file.extension === "md" && !this.host.isExcalidrawFile(file),
      async (value) => {
        if (!this.store.getInitialPluginDataBackup()) {
          const backup = await this.safety.backupInitialPluginData();
          await this.store.recordInitialPluginDataBackup(backup);
        }
        await this.store.createUnitWithInstance({
          name: value.name,
          documentPath: value.documentPath,
          content: snapshot.content,
          instance: {
            canvasPath,
            memberElementIds: snapshot.memberElementIds,
            origin: snapshot.origin,
          },
        });
        new Notice(`已建立元素单位“${value.name.trim()}”。`);
      },
    ).open();
  }

  public getSelectedInstance(view: ExcalidrawView) {
    for (const element of view.getViewSelectedElements()) {
      const instance = this.store.getInstanceByElement(view.file.path, element.id);
      if (instance) return instance;
    }
    return null;
  }

  public openImportIntoCanvas(view: ExcalidrawView, mode: SemanticUnitImportMode): void {
    const units = this.store.getUnits();
    if (units.length === 0) {
      new Notice("尚未建立可引入的画布语义单位。");
      return;
    }
    const canvasPath = view.file?.path;
    if (!canvasPath) {
      new Notice("无法识别当前二维画布。");
      return;
    }
    const origin = { x: view.currentPosition.x, y: view.currentPosition.y };
    new SemanticUnitImportModal(
      this.host.app,
      units,
      mode,
      (sourceName) => this.suggestIndependentCopyName(sourceName),
      async ({ unitId, copyName }) => {
        await this.importIntoCanvas(view, canvasPath, origin, unitId, mode, copyName);
      },
    ).open();
  }

  public highlightSelectedInstance(view: ExcalidrawView): void {
    const instance = this.getSelectedInstance(view);
    if (!instance) return;
    const memberIds = new Set(Object.values(instance.memberElementIds));
    const elements = view.getViewElements().filter((element) => memberIds.has(element.id));
    this.showTransientMembershipOverlay(view, elements);
    const unit = this.store.getUnit(instance.unitId);
    new Notice(`已显示元素单位“${unit?.name ?? "未命名"}”的 ${elements.length} 个成员。`);
  }

  public canAddSelectionToInstance(view: ExcalidrawView): boolean {
    const instance = this.getSelectedInstance(view);
    if (!instance) return false;
    return view.getViewSelectedElements()
      .some((element) => !this.store.getInstanceByElement(view.file.path, element.id));
  }

  public canRemoveSelectionFromInstance(view: ExcalidrawView): boolean {
    const instance = this.getSelectedInstance(view);
    if (!instance) return false;
    const selectedIds = new Set(view.getViewSelectedElements().map((element) => element.id));
    const selectedMemberCount = Object.values(instance.memberElementIds)
      .filter((elementId) => selectedIds.has(elementId)).length;
    return selectedMemberCount > 0 && selectedMemberCount < Object.keys(instance.memberElementIds).length;
  }

  public async addSelectionToInstance(view: ExcalidrawView): Promise<void> {
    const instance = this.getSelectedInstance(view);
    const unit = instance ? this.store.getUnit(instance.unitId) : null;
    if (!instance || !unit) return;
    const additions = appendSemanticUnitMembers(
      unit.content,
      instance.memberElementIds,
      instance.origin,
      view.getViewSelectedElements(),
      view.excalidrawAPI?.getFiles() ?? {},
    );
    const revision = await this.store.replaceCanonicalContent(unit.id, unit.revision, additions.content);
    await this.store.updateInstanceMembers(instance.id, additions.memberElementIds, revision);
    await this.propagateUnitRevision(unit.id, instance.id, view);
    new Notice("已将所选新内容纳入元素单位；画布元素本身未被改写。");
  }

  public async removeSelectionFromInstance(view: ExcalidrawView): Promise<void> {
    const instance = this.getSelectedInstance(view);
    const unit = instance ? this.store.getUnit(instance.unitId) : null;
    if (!instance || !unit) return;
    const selectedIds = new Set(view.getViewSelectedElements().map((element) => element.id));
    const removal = removeSemanticUnitMembers(unit.content, instance.memberElementIds, selectedIds);
    const revision = await this.store.replaceCanonicalContent(unit.id, unit.revision, removal.content);
    await this.store.updateInstanceMembers(instance.id, removal.memberElementIds, revision);
    await this.propagateUnitRevision(unit.id, instance.id, view);
    new Notice("已将所选内容移出元素单位；画布元素仍保留在原处。");
  }

  public async dissolveSelectedInstance(view: ExcalidrawView): Promise<void> {
    const instance = this.getSelectedInstance(view);
    if (!instance) return;
    await this.store.dissolveInstance(instance.id);
    this.scheduleInstanceStateOverlayRefresh(view);
    new Notice("已解除当前实例的语义关系，画布元素未被删除或修改。");
  }

  public async toggleSelectedInstanceLocked(view: ExcalidrawView): Promise<void> {
    const instance = this.getSelectedInstance(view);
    if (!instance) return;
    await this.setInstanceLocked(view, instance, !instance.state.locked);
  }

  public async setUnitInstancesLocked(unitId: string, locked: boolean): Promise<void> {
    await this.store.updateUnitInstancesLocked(unitId, locked);
    const canvasPaths = new Set(this.store.getInstancesForUnit(unitId).map((instance) => instance.canvasPath));
    for (const view of getExcalidrawViews(this.host.app, true)) {
      if (view.file?.path && canvasPaths.has(view.file.path)) {
        this.scheduleInstanceStateOverlayRefresh(view);
      }
    }
  }

  private async setInstanceLocked(
    view: ExcalidrawView,
    instance: SemanticUnitInstance,
    locked: boolean,
  ): Promise<void> {
    await this.store.updateInstanceLocked(instance.id, locked);
    if (locked) view.excalidrawAPI?.selectElements([]);
    this.scheduleInstanceStateOverlayRefresh(view);
    new Notice(locked ? "已锁定当前元素单位实例。" : "已解锁当前元素单位实例。");
  }

  private async importIntoCanvas(
    view: ExcalidrawView,
    canvasPath: string,
    origin: { x: number; y: number },
    unitId: string,
    mode: SemanticUnitImportMode,
    copyName?: string,
  ): Promise<void> {
    const sourceUnit = this.store.getUnit(unitId);
    if (!sourceUnit) throw new Error("找不到要引入的元素单位。");
    const materialized = materializeSemanticUnitContent(sourceUnit.content, origin);
    this.suppressSceneChangesUntil.set(view, Date.now() + 2500);
    await view.forceSave(true, true);
    const prepared = await this.safety.prepareCanvasWrite(
      canvasPath,
      mode === "synchronized" ? "insert-synchronized-instance" : "insert-independent-copy",
    );
    await this.store.recordCanvasBackup(prepared.backup);
    await prepared.assertSourceUnchanged();

    let registeredInstanceId: string | null = null;
    let registeredUnitId: string | null = null;
    try {
      if (mode === "synchronized") {
        const instance = await this.store.createSynchronizedInstance({
          unitId: sourceUnit.id,
          canvasPath,
          memberElementIds: materialized.memberElementIds,
          origin,
        });
        registeredInstanceId = instance.id;
      } else {
        const result = await this.store.createUnitWithInstance({
          name: copyName ?? this.suggestIndependentCopyName(sourceUnit.name),
          documentPath: sourceUnit.documentPath,
          tags: sourceUnit.tags,
          properties: sourceUnit.properties,
          owner: sourceUnit.owner,
          content: sourceUnit.content,
          instance: {
            canvasPath,
            memberElementIds: materialized.memberElementIds,
            origin,
          },
        });
        registeredUnitId = result.unit.id;
        registeredInstanceId = result.instance.id;
      }

      if (materialized.files.length > 0) {
        view.excalidrawAPI.addFiles(materialized.files as unknown as BinaryFileData[]);
      }
      const selectedElementIds = Object.fromEntries(
        materialized.elements.map((element) => [element.id, true as const]),
      ) as Record<string, true>;
      view.updateScene({
        elements: [...view.getViewElements(), ...materialized.elements],
        appState: { selectedElementIds },
        storeAction: "capture",
      }, true);
      const insertedIds = new Set(view.getViewElements().map((element) => element.id));
      if (materialized.elements.some((element) => !insertedIds.has(element.id))) {
        throw new Error("画布未能完整接收元素单位，语义登记已撤销。");
      }
      view.setDirty();
      await view.forceSave(true, true);
      const registered = registeredInstanceId ? this.store.getInstance(registeredInstanceId) : null;
      if (registered) await this.repairSavedInstanceMapping(view, sourceUnit.content, registered);
      const name = mode === "synchronized" ? sourceUnit.name : (copyName ?? sourceUnit.name);
      new Notice(mode === "synchronized"
        ? `已引入“${name}”的同步实例。`
        : `已创建互不关联的元素单位“${name}”。`);
    } catch (error) {
      if (registeredUnitId) await this.store.dissolveUnit(registeredUnitId);
      else if (registeredInstanceId) await this.store.dissolveInstance(registeredInstanceId);
      throw error;
    }
  }

  private suggestIndependentCopyName(sourceName: string): string {
    const names = new Set(this.store.getUnits().map((unit) => unit.name.toLocaleLowerCase()));
    const base = `${sourceName} 副本`;
    if (!names.has(base.toLocaleLowerCase())) return base;
    let suffix = 2;
    while (names.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
    return `${base} ${suffix}`;
  }

  private async processViewChanges(
    view: ExcalidrawView,
    opening: boolean,
    sourceAlreadySaved: boolean = false,
  ): Promise<boolean> {
    if (this.processingViews.has(view) || !view.file?.path || !view.excalidrawAPI) return false;
    this.processingViews.add(view);
    try {
      const canvasPath = view.file.path;
      const instances = this.store.getInstancesForCanvas(canvasPath);
      if (instances.length === 0) return true;
      if (!opening) {
        this.suppressSceneChangesUntil.set(view, Date.now() + 2500);
        if (!sourceAlreadySaved) await view.forceSave(true, true);
      }
      const sceneElements = view.getViewElements();
      const files = view.excalidrawAPI.getFiles();
      for (const instance of instances) {
        const unit = this.store.getUnit(instance.unitId);
        if (!unit) continue;
        const claimed = new Set(instances
          .filter((candidate) => candidate.id !== instance.id)
          .flatMap((candidate) => Object.values(candidate.memberElementIds)));
        const repaired = repairSemanticUnitInstanceMapping(
          unit.content,
          instance,
          sceneElements,
          claimed,
        );
        const workingInstance: SemanticUnitInstance = {
          ...instance,
          memberElementIds: { ...instance.memberElementIds, ...repaired.memberElementIds },
        };
        if (repaired.matchedMemberIds.length === 0) {
          await this.store.dissolveInstance(instance.id);
          if (!opening) new Notice(`已解除画布中被完整删除的元素单位“${unit.name}”。`);
          continue;
        }
        if (instance.appliedRevision < unit.revision) {
          await this.applyCanonicalToOpenInstance(view, instance);
          continue;
        }
        const captured = captureSemanticUnitInstance(
          unit.content,
          workingInstance,
          sceneElements,
          files,
        );
        if (!captured) continue;
        if (
          Math.abs(captured.origin.x - instance.origin.x) >= 0.1 ||
          Math.abs(captured.origin.y - instance.origin.y) >= 0.1
        ) {
          await this.store.updateInstanceOrigin(instance.id, captured.origin);
        }
        const contentChanged = semanticUnitContentFingerprint(captured.content) !==
          semanticUnitContentFingerprint(unit.content);
        if (!contentChanged) {
          if (
            repaired.missingMemberIds.length === 0 &&
            JSON.stringify(repaired.memberElementIds) !== JSON.stringify(instance.memberElementIds)
          ) {
            await this.store.updateInstanceMembers(
              instance.id,
              repaired.memberElementIds,
              unit.revision,
            );
          }
          continue;
        }
        const revision = await this.store.replaceCanonicalContent(
          unit.id,
          unit.revision,
          captured.content,
        );
        await this.store.updateInstanceMembers(
          instance.id,
          captured.memberElementIds,
          revision,
        );
        await this.propagateUnitRevision(unit.id, instance.id, view);
      }
      return true;
    } finally {
      this.processingViews.delete(view);
    }
  }

  private async propagateUnitRevision(
    unitId: string,
    sourceInstanceId: string,
    sourceView: ExcalidrawView,
  ): Promise<void> {
    const openViews = getExcalidrawViews(this.host.app, true);
    const handledCanvasPaths = new Set<string>();
    for (const instance of this.store.getInstancesForUnit(unitId)) {
      if (instance.id === sourceInstanceId || handledCanvasPaths.has(instance.canvasPath)) continue;
      const targetView = instance.canvasPath === sourceView.file?.path
        ? sourceView
        : openViews.find((candidate) => candidate.file?.path === instance.canvasPath);
      if (!targetView) continue;
      handledCanvasPaths.add(instance.canvasPath);
      const targetInstances = this.store.getInstancesForCanvas(instance.canvasPath)
        .filter((candidate) => candidate.unitId === unitId && candidate.id !== sourceInstanceId);
      for (const target of targetInstances) {
        await this.applyCanonicalToOpenInstance(targetView, target);
      }
    }
  }

  private async applyCanonicalToOpenInstance(
    view: ExcalidrawView,
    staleInstance: SemanticUnitInstance,
  ): Promise<void> {
    const unit = this.store.getUnit(staleInstance.unitId);
    const instance = this.store.getInstance(staleInstance.id);
    if (!unit || !instance || instance.appliedRevision >= unit.revision) return;
    const sceneElements = view.getViewElements();
    const otherClaimedIds = new Set(this.store.getInstancesForCanvas(instance.canvasPath)
      .filter((candidate) => candidate.id !== instance.id)
      .flatMap((candidate) => Object.values(candidate.memberElementIds)));
    const repaired = repairSemanticUnitInstanceMapping(
      unit.content,
      instance,
      sceneElements,
      otherClaimedIds,
    );
    if (repaired.matchedMemberIds.length === 0) {
      await this.store.dissolveInstance(instance.id);
      return;
    }
    const workingInstance: SemanticUnitInstance = {
      ...instance,
      memberElementIds: { ...instance.memberElementIds, ...repaired.memberElementIds },
    };
    const reconciled = reconcileSemanticUnitInstance(unit.content, workingInstance, sceneElements);
    this.suppressSceneChangesUntil.set(view, Date.now() + 2500);
    await view.forceSave(true, true);
    const prepared = await this.safety.prepareCanvasWrite(instance.canvasPath, "synchronize-instance");
    await this.store.recordCanvasBackup(prepared.backup);
    await prepared.assertSourceUnchanged();
    this.suppressSceneChangesUntil.set(view, Date.now() + 2500);
    const registeredIds = new Set(Object.values(workingInstance.memberElementIds));
    const remainingElements = sceneElements.filter((element) => !registeredIds.has(element.id));
    if (reconciled.files.length > 0) {
      view.excalidrawAPI.addFiles(reconciled.files as unknown as BinaryFileData[]);
    }
    view.updateScene({
      elements: [...remainingElements, ...reconciled.elements, ...reconciled.removedElements],
      storeAction: "capture",
    }, true);
    view.setDirty();
    await view.forceSave(true, true);
    const refreshedInstance: SemanticUnitInstance = {
      ...instance,
      memberElementIds: reconciled.memberElementIds,
      appliedRevision: unit.revision,
    };
    await this.repairSavedInstanceMapping(view, unit.content, refreshedInstance);
  }

  private async repairSavedInstanceMapping(
    view: ExcalidrawView,
    content: SemanticUnitContentSnapshot,
    instance: SemanticUnitInstance,
  ): Promise<void> {
    const claimed = new Set(this.store.getInstancesForCanvas(instance.canvasPath)
      .filter((candidate) => candidate.id !== instance.id)
      .flatMap((candidate) => Object.values(candidate.memberElementIds)));
    const repaired = repairSemanticUnitInstanceMapping(
      content,
      instance,
      view.getViewElements(),
      claimed,
    );
    if (repaired.missingMemberIds.length > 0) {
      throw new Error("画布保存后有成员身份未能保持，本次同步已停止。");
    }
    await this.store.updateInstanceMembers(
      instance.id,
      repaired.memberElementIds,
      this.store.getUnit(instance.unitId)?.revision ?? instance.appliedRevision,
    );
  }

  private showTransientMembershipOverlay(
    view: ExcalidrawView,
    elements: readonly ExcalidrawElement[],
  ): void {
    const host = view.excalidrawContainer;
    if (!host || elements.length === 0) return;
    this.dismissTransientMembershipOverlay(view);
    const appState = view.excalidrawAPI.getAppState();
    const hostBounds = host.getBoundingClientRect();
    const overlay = host.createDiv({
      cls: "ks-semantic-membership-overlay",
      attr: { "aria-hidden": "true" },
    });
    setStyle(overlay, {
      left: "0",
      top: "0",
      width: `${hostBounds.width}px`,
      height: `${hostBounds.height}px`,
    });
    for (const element of elements) {
      const topLeft = sceneCoordsToViewportCoords(
        { sceneX: element.x, sceneY: element.y },
        appState,
      );
      const bottomRight = sceneCoordsToViewportCoords(
        { sceneX: element.x + element.width, sceneY: element.y + element.height },
        appState,
      );
      const marker = overlay.createDiv({ cls: "ks-semantic-membership-overlay__member" });
      setStyle(marker, {
        left: `${topLeft.x - hostBounds.left - 5}px`,
        top: `${topLeft.y - hostBounds.top - 5}px`,
        width: `${Math.max(10, bottomRight.x - topLeft.x + 10)}px`,
        height: `${Math.max(10, bottomRight.y - topLeft.y + 10)}px`,
      });
    }
    const ownerWindow = view.ownerWindow ?? window;
    let timeoutId: number | null = null;
    const dismiss = () => {
      host.removeEventListener("pointerdown", dismiss, true);
      host.removeEventListener("wheel", dismiss, true);
      ownerWindow.removeEventListener("keydown", dismiss, true);
      if (timeoutId !== null) ownerWindow.clearTimeout(timeoutId);
      overlay.remove();
      if (this.transientOverlayDismissers.get(view) === dismiss) {
        this.transientOverlayDismissers.delete(view);
      }
    };
    this.transientOverlayDismissers.set(view, dismiss);
    host.addEventListener("pointerdown", dismiss, true);
    host.addEventListener("wheel", dismiss, true);
    ownerWindow.addEventListener("keydown", dismiss, true);
    timeoutId = ownerWindow.setTimeout(dismiss, 6000);
  }

  private dismissTransientMembershipOverlay(view: ExcalidrawView): void {
    const dismiss = this.transientOverlayDismissers.get(view);
    if (dismiss) {
      dismiss();
      return;
    }
    view.excalidrawContainer
      ?.querySelector(".ks-semantic-membership-overlay")
      ?.remove();
  }

  private scheduleInstanceStateOverlayRefresh(view: ExcalidrawView): void {
    const ownerWindow = view.ownerWindow ?? window;
    const previous = this.stateOverlayFrames.get(view);
    if (previous !== undefined) ownerWindow.cancelAnimationFrame(previous);
    const frame = ownerWindow.requestAnimationFrame(() => {
      this.stateOverlayFrames.delete(view);
      this.refreshInstanceStateOverlay(view);
    });
    this.stateOverlayFrames.set(view, frame);
  }

  private refreshInstanceStateOverlay(view: ExcalidrawView): void {
    this.stateOverlayRoots.get(view)?.remove();
    this.stateOverlayRoots.delete(view);
    const host = view.excalidrawContainer;
    const canvasPath = view.file?.path;
    if (!host || !canvasPath || !view.excalidrawAPI) return;
    const instances = this.store.getInstancesForCanvas(canvasPath)
      .filter((instance) => instance.state.locked);
    if (instances.length === 0) return;
    const elementsById = new Map(view.getViewElements().map((element) => [element.id, element]));
    const appState = view.excalidrawAPI.getAppState();
    const hostBounds = host.getBoundingClientRect();
    const overlay = host.createDiv({
      cls: "ks-semantic-state-overlay",
      attr: { "aria-label": "画布语义单位状态层" },
    });
    setStyle(overlay, {
      left: "0",
      top: "0",
      width: `${hostBounds.width}px`,
      height: `${hostBounds.height}px`,
    });
    this.stateOverlayRoots.set(view, overlay);
    for (const instance of instances) {
      const unit = this.store.getUnit(instance.unitId);
      const elements = Object.values(instance.memberElementIds)
        .map((id) => elementsById.get(id))
        .filter((element): element is ExcalidrawElement => Boolean(element));
      elements.forEach((element, index) => {
        const topLeft = sceneCoordsToViewportCoords(
          { sceneX: element.x, sceneY: element.y },
          appState,
        );
        const bottomRight = sceneCoordsToViewportCoords(
          { sceneX: element.x + element.width, sceneY: element.y + element.height },
          appState,
        );
        const marker = overlay.createDiv({
          cls: "ks-semantic-state-overlay__member is-locked",
          attr: { "aria-label": `${unit?.name ?? "元素单位"}，已锁定` },
        });
        setStyle(marker, {
          left: `${topLeft.x - hostBounds.left - 3}px`,
          top: `${topLeft.y - hostBounds.top - 3}px`,
          width: `${Math.max(8, bottomRight.x - topLeft.x + 6)}px`,
          height: `${Math.max(8, bottomRight.y - topLeft.y + 6)}px`,
        });
        marker.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        marker.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        marker.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.showInstanceStateMenu(event, view, instance);
        });
        if (index === 0) {
          marker.createSpan({
            cls: "ks-semantic-state-overlay__label",
            text: `已锁定 · ${unit?.name ?? "元素单位"}`,
          });
        }
      });
    }
  }

  private showInstanceStateMenu(
    event: MouseEvent,
    view: ExcalidrawView,
    instance: SemanticUnitInstance,
  ): void {
    const latest = this.store.getInstance(instance.id);
    if (!latest) return;
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle(latest.state.locked ? "解锁元素单位" : "锁定元素单位")
      .setIcon(latest.state.locked ? "unlock" : "lock")
      .onClick(() => { void this.setInstanceLocked(view, latest, !latest.state.locked); }));
    menu.addItem((item) => item
      .setTitle("显示元素单位内容")
      .setIcon("scan")
      .onClick(() => {
        const memberIds = new Set(Object.values(latest.memberElementIds));
        this.showTransientMembershipOverlay(
          view,
          view.getViewElements().filter((element) => memberIds.has(element.id)),
        );
      }));
    menu.showAtMouseEvent(event);
  }
}
