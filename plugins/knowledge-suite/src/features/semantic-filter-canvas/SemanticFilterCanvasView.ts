import {
  ItemView,
  Menu,
  Notice,
  setIcon,
  type WorkspaceLeaf,
} from "obsidian";
import { setStyle } from "../../utils/styleUtils";
import { clampOverviewZoom } from "../../core/overviewZoom";
import { t } from "../../lang/helpers";
import type DocumentMetadataController from "../document-metadata/DocumentMetadataController";
import { FilterBuilderModal } from "../document-metadata/ui/FilterBuilderModal";
import type {
  DocumentFieldDefinition,
  DocumentFilterDefinition,
} from "../document-metadata/types";
import { SemanticFilterQueryService } from "./SemanticFilterQueryService";
import type { SemanticFilterMatch } from "./filterQuery";
import { SemanticUnitPreviewRenderer } from "./SemanticUnitPreviewRenderer";
import { SemanticMarkdownPickerModal } from "../semantic-units/SemanticMarkdownPickerModal";
import {
  buildTemporarySemanticLayout,
  semanticFilterCardSize,
  type SemanticFilterCanvasSize,
  type SemanticFilterCanvasPosition,
} from "./temporaryLayout";
import { shouldPanSemanticFilterViewport } from "./viewportPan";

type SemanticFilterTheme = "light" | "dark";

export const SEMANTIC_FILTER_CANVAS_VIEW_TYPE = "knowledge-suite-semantic-filter-canvas";

const format = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );

const cloneFilter = (filter: DocumentFilterDefinition): DocumentFilterDefinition =>
  structuredClone(filter);

/**
 * Read-only, ephemeral canvas for arranging semantic units selected through
 * their bound Markdown metadata. It never creates instances or persists layout.
 */
export class SemanticFilterCanvasView extends ItemView {
  private readonly query: SemanticFilterQueryService;
  private readonly previews = new SemanticUnitPreviewRenderer();
  private metadataUnsubscribe: (() => void) | null = null;
  private semanticUnsubscribe: (() => void) | null = null;
  private renderTimer: number | null = null;
  private renderGeneration = 0;
  private filter: DocumentFilterDefinition = { match: "all", conditions: [] };
  private search = "";
  private restoreSearchFocus = false;
  private positions = new Map<string, SemanticFilterCanvasPosition>();
  private pan = { x: 0, y: 0 };
  private zoom = 1;

  constructor(leaf: WorkspaceLeaf, private readonly controller: DocumentMetadataController) {
    super(leaf);
    if (!controller.semanticUnits) {
      throw new Error("Semantic units are unavailable.");
    }
    this.query = new SemanticFilterQueryService(
      controller.app,
      controller.service,
      controller.semanticUnits.store,
    );
  }

  public getViewType(): string {
    return SEMANTIC_FILTER_CANVAS_VIEW_TYPE;
  }

  public getDisplayText(): string {
    return t("SEMANTIC_FILTER_CANVAS_TITLE");
  }

  public getIcon(): string {
    return "scan-search";
  }

  public async onOpen(): Promise<void> {
    this.contentEl.addClass("ks-semantic-filter-canvas");
    this.metadataUnsubscribe = this.controller.service.subscribe(() => this.scheduleRender());
    this.semanticUnsubscribe = this.controller.semanticUnits?.store.subscribe(() => this.scheduleRender()) ?? null;
    await this.render();
  }

  public async onClose(): Promise<void> {
    this.metadataUnsubscribe?.();
    this.metadataUnsubscribe = null;
    this.semanticUnsubscribe?.();
    this.semanticUnsubscribe = null;
    const ownerWindow = this.contentEl.ownerDocument.defaultView ?? window;
    if (this.renderTimer !== null) ownerWindow.clearTimeout(this.renderTimer);
    this.positions.clear();
  }

  private scheduleRender(): void {
    const ownerWindow = this.contentEl.ownerDocument.defaultView ?? window;
    if (this.renderTimer !== null) ownerWindow.clearTimeout(this.renderTimer);
    this.renderTimer = ownerWindow.setTimeout(() => {
      this.renderTimer = null;
      void this.render();
    }, 120);
  }

  private async render(): Promise<void> {
    const generation = ++this.renderGeneration;
    let snapshot;
    try {
      snapshot = await this.query.query(this.filter);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : t("SEMANTIC_FILTER_QUERY_FAILED"));
      return;
    }
    if (generation !== this.renderGeneration) return;
    const normalizedSearch = this.search.trim().toLocaleLowerCase();
    const matches = snapshot.matches.filter((match) => !normalizedSearch ||
      match.unit.name.toLocaleLowerCase().includes(normalizedSearch) ||
      (match.documentPath ?? "").toLocaleLowerCase().includes(normalizedSearch));

    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: "ks-semantic-filter-header" });
    const identity = header.createDiv({ cls: "ks-semantic-filter-header__identity" });
    const mark = identity.createSpan({ cls: "ks-semantic-filter-header__mark" });
    setIcon(mark, "scan-search");
    const heading = identity.createDiv({ cls: "ks-semantic-filter-header__copy" });
    heading.createEl("h2", { text: t("SEMANTIC_FILTER_CANVAS_TITLE") });
    heading.createDiv({
      cls: "ks-semantic-filter-header__subtitle",
      text: t("SEMANTIC_FILTER_CANVAS_SUBTITLE"),
    });
    const headerActions = header.createDiv({ cls: "ks-semantic-filter-header__actions" });
    const refresh = headerActions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("SEMANTIC_FILTER_REFRESH") },
    });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());
    const reset = headerActions.createEl("button", {
      cls: "ks-semantic-filter-button is-secondary",
      attr: { "aria-label": t("SEMANTIC_FILTER_RESET_LAYOUT") },
    });
    const resetIcon = reset.createSpan();
    setIcon(resetIcon, "layout-grid");
    reset.createSpan({ text: t("SEMANTIC_FILTER_RESET_LAYOUT") });
    reset.addEventListener("click", () => {
      this.positions.clear();
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      void this.render();
    });

    const toolbar = this.contentEl.createDiv({ cls: "ks-semantic-filter-toolbar" });
    const searchWrap = toolbar.createDiv({ cls: "ks-semantic-filter-search" });
    const searchIcon = searchWrap.createSpan();
    setIcon(searchIcon, "search");
    const searchInput = searchWrap.createEl("input", {
      type: "search",
      placeholder: t("SEMANTIC_FILTER_SEARCH_PLACEHOLDER"),
      attr: { "aria-label": t("SEMANTIC_FILTER_SEARCH_PLACEHOLDER") },
    });
    searchInput.value = this.search;
    if (this.restoreSearchFocus) {
      (this.contentEl.ownerDocument.defaultView ?? window).requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      });
    }
    searchInput.addEventListener("blur", () => { this.restoreSearchFocus = false; });
    searchInput.addEventListener("input", () => {
      this.search = searchInput.value;
      this.restoreSearchFocus = true;
      this.scheduleRender();
    });
    const filterButton = toolbar.createEl("button", {
      cls: "ks-semantic-filter-button is-primary",
      attr: { "aria-label": t("SEMANTIC_FILTER_OPEN_FILTER") },
    });
    const filterIcon = filterButton.createSpan();
    setIcon(filterIcon, "list-filter");
    filterButton.createSpan({ text: t("SEMANTIC_FILTER_FILTER") });
    if (this.filter.conditions.length > 0) {
      filterButton.createSpan({
        cls: "ks-semantic-filter-button__count",
        text: String(this.filter.conditions.length),
      });
    }
    const fields = this.controller.service.getFields().filter((field) => !field.archived);
    filterButton.disabled = fields.length === 0;
    filterButton.addEventListener("click", () => this.openFilter(fields));
    if (this.filter.conditions.length > 0) {
      const clear = toolbar.createEl("button", {
        cls: "ks-semantic-filter-clear",
        text: t("SEMANTIC_FILTER_CLEAR"),
      });
      clear.addEventListener("click", () => {
        this.filter = { match: "all", conditions: [] };
        void this.render();
      });
    }
    this.renderFilterSummary(toolbar, fields);

    const status = this.contentEl.createDiv({ cls: "ks-semantic-filter-status" });
    status.createSpan({
      cls: "ks-semantic-filter-status__primary",
      text: format(t("SEMANTIC_FILTER_RESULT_SUMMARY"), {
        MATCHED: matches.length,
        LINKED: snapshot.linkedUnitCount,
        UNBOUND: snapshot.unboundUnitCount,
      }),
    });
    status.createSpan({ cls: "ks-semantic-filter-status__readonly", text: t("SEMANTIC_FILTER_READ_ONLY") });
    if (snapshot.unavailableBindingCount > 0) {
      status.createSpan({
        cls: "ks-semantic-filter-status__warning",
        text: format(t("SEMANTIC_FILTER_UNAVAILABLE_SUMMARY"), {
          COUNT: snapshot.unavailableBindingCount,
        }),
      });
    }

    if (snapshot.linkedUnitCount + snapshot.unboundUnitCount === 0) {
      this.renderEmpty("link-2-off", t("SEMANTIC_FILTER_NO_BOUND_TITLE"), t("SEMANTIC_FILTER_NO_BOUND_DESC"));
      return;
    }
    if (matches.length === 0) {
      this.renderEmpty("search-x", t("SEMANTIC_FILTER_NO_MATCH_TITLE"), t("SEMANTIC_FILTER_NO_MATCH_DESC"));
      return;
    }
    this.renderCanvas(matches, generation);
  }

  private openFilter(fields: DocumentFieldDefinition[]): void {
    if (fields.length === 0) return;
    new FilterBuilderModal(
      this.app,
      fields,
      cloneFilter(this.filter),
      async (filter) => {
        this.filter = cloneFilter(filter);
        await this.render();
      },
      {
        title: t("SEMANTIC_FILTER_MODAL_TITLE"),
        description: t("SEMANTIC_FILTER_MODAL_DESC"),
      },
    ).open();
  }

  private renderFilterSummary(parent: HTMLElement, fields: DocumentFieldDefinition[]): void {
    if (this.filter.conditions.length === 0) return;
    const summary = parent.createDiv({ cls: "ks-semantic-filter-chips" });
    summary.createSpan({
      cls: "ks-semantic-filter-chips__logic",
      text: this.filter.match === "all"
        ? t("SEMANTIC_FILTER_MATCH_ALL")
        : t("SEMANTIC_FILTER_MATCH_ANY"),
    });
    for (const condition of this.filter.conditions) {
      const field = fields.find((candidate) => candidate.id === condition.fieldId);
      if (field) summary.createSpan({ cls: "ks-semantic-filter-chip", text: field.name });
    }
  }

  private renderEmpty(iconName: string, title: string, description: string): void {
    const empty = this.contentEl.createDiv({ cls: "ks-semantic-filter-empty" });
    const icon = empty.createSpan({ cls: "ks-semantic-filter-empty__icon" });
    setIcon(icon, iconName);
    empty.createEl("h3", { text: title });
    empty.createDiv({ text: description });
  }

  private renderCanvas(matches: SemanticFilterMatch[], generation: number): void {
    const viewport = this.contentEl.createDiv({ cls: "ks-semantic-filter-viewport" });
    const stage = viewport.createDiv({ cls: "ks-semantic-filter-stage" });
    const viewportWidth = Math.max(760, viewport.clientWidth || this.contentEl.clientWidth);
    const items = matches.map((match) => ({
      id: match.unit.id,
      ...semanticFilterCardSize(match.unit.content.bounds),
    }));
    const sizes = new Map(items.map((item) => [item.id, {
      width: item.width,
      height: item.height,
    }]));
    this.positions = buildTemporarySemanticLayout(
      items,
      this.positions,
      viewportWidth,
    );
    const stageWidth = Math.max(1600, ...[...this.positions.entries()].map(([id, position]) => (
      position.x + (sizes.get(id)?.width ?? 0) + 80
    )));
    const stageHeight = Math.max(1000, ...[...this.positions.entries()].map(([id, position]) => (
      position.y + (sizes.get(id)?.height ?? 0) + 80
    )));
    setStyle(stage, { width: `${stageWidth}px`, height: `${stageHeight}px` });
    this.applyStageTransform(stage);
    const theme: SemanticFilterTheme = this.contentEl.ownerDocument.body.classList.contains("theme-dark")
      ? "dark"
      : "light";
    for (const match of matches) {
      const size = sizes.get(match.unit.id);
      if (size) this.renderCard(stage, match, size, theme, generation);
    }
    this.attachViewportPan(viewport, stage);
    this.renderZoomControls(viewport, stage);
  }

  private renderCard(
    stage: HTMLElement,
    match: SemanticFilterMatch,
    size: SemanticFilterCanvasSize,
    theme: SemanticFilterTheme,
    generation: number,
  ): void {
    const position = this.positions.get(match.unit.id);
    if (!position) return;
    const card = stage.createDiv({
      cls: "ks-semantic-filter-card",
      attr: {
        "aria-label": format(t("SEMANTIC_FILTER_UNIT_ARIA"), { NAME: match.unit.name }),
      },
    });
    setStyle(card, {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
    });
    const header = card.createDiv({ cls: "ks-semantic-filter-card__header" });
    const icon = header.createSpan({ cls: "ks-semantic-filter-card__icon" });
    setIcon(icon, "boxes");
    const copy = header.createDiv({ cls: "ks-semantic-filter-card__copy" });
    copy.createDiv({ cls: "ks-semantic-filter-card__name", text: match.unit.name });
    copy.createDiv({ cls: "ks-semantic-filter-card__document", text: match.documentPath ?? t("SEMANTIC_FILTER_UNBOUND_DOCUMENT") });
    const grip = header.createSpan({ cls: "ks-semantic-filter-card__grip" });
    setIcon(grip, "grip");
    const preview = card.createDiv({ cls: "ks-semantic-filter-card__preview is-loading" });
    const placeholder = preview.createDiv({ cls: "ks-semantic-filter-card__placeholder" });
    const placeholderIcon = placeholder.createSpan();
    setIcon(placeholderIcon, "shapes");
    void this.previews.render(match.unit, theme)
      .then((svg) => {
        if (generation !== this.renderGeneration || !preview.isConnected) return;
        preview.empty();
        preview.removeClass("is-loading");
        preview.appendChild(svg);
      })
      .catch(() => {
        if (generation !== this.renderGeneration || !preview.isConnected) return;
        preview.empty();
        preview.removeClass("is-loading");
        preview.addClass("is-error");
        const errorIcon = preview.createSpan();
        setIcon(errorIcon, "image-off");
        preview.createSpan({ text: t("SEMANTIC_FILTER_PREVIEW_ERROR") });
      });
    this.attachCardDrag(card, match.unit.id);
    this.attachCardContextMenu(card, match);
  }

  private attachCardContextMenu(card: HTMLElement, match: SemanticFilterMatch): void {
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const latest = this.controller.semanticUnits?.store.getUnit(match.unit.id);
      if (!latest) return;
      const menu = Menu.forEvent(event).setUseNativeMenu(false);
      menu.addItem((item) => item
        .setTitle(t("SEMANTIC_FILTER_MARKDOWN_CHANGE"))
        .setIcon("file-cog")
        .onClick(() => this.openMarkdownPicker(latest.id, latest.documentPath)));
      if (latest.documentPath) {
        menu.addSeparator();
        menu.addItem((item) => item
          .setTitle(t("SEMANTIC_FILTER_MARKDOWN_UNLINK"))
          .setIcon("unlink")
          .setWarning(true)
          .onClick(() => { void this.updateMarkdownRelationship(latest.id, null); }));
      }
      menu.showAtMouseEvent(event);
    });
  }

  private openMarkdownPicker(unitId: string, selectedPath: string | null): void {
    new SemanticMarkdownPickerModal(
      this.app,
      selectedPath,
      (file) => this.controller.service.isManagedMarkdownFile(file),
      (path) => {
        if (path === selectedPath) return;
        void this.updateMarkdownRelationship(unitId, path);
      },
    ).open();
  }

  private async updateMarkdownRelationship(unitId: string, documentPath: string | null): Promise<void> {
    const semanticUnits = this.controller.semanticUnits;
    if (!semanticUnits) return;
    try {
      await semanticUnits.store.updateUnitDocumentPath(unitId, documentPath);
      new Notice(documentPath
        ? format(t("SEMANTIC_FILTER_MARKDOWN_UPDATED"), { PATH: documentPath })
        : t("SEMANTIC_FILTER_MARKDOWN_UNLINKED"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : t("SEMANTIC_FILTER_MARKDOWN_UPDATE_FAILED"));
    }
  }

  private attachCardDrag(card: HTMLElement, unitId: string): void {
    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const position = this.positions.get(unitId);
      if (!position) return;
      event.preventDefault();
      event.stopPropagation();
      card.setPointerCapture(event.pointerId);
      card.addClass("is-dragging");
      const start = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        positionX: position.x,
        positionY: position.y,
      };
      const move = (moveEvent: PointerEvent) => {
        const next = {
          x: start.positionX + (moveEvent.clientX - start.pointerX) / this.zoom,
          y: start.positionY + (moveEvent.clientY - start.pointerY) / this.zoom,
        };
        this.positions.set(unitId, next);
        setStyle(card, { left: `${next.x}px`, top: `${next.y}px` });
      };
      const finish = () => {
        card.removeClass("is-dragging");
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", finish);
        card.removeEventListener("pointercancel", finish);
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerup", finish);
      card.addEventListener("pointercancel", finish);
    });
  }

  private attachViewportPan(viewport: HTMLElement, stage: HTMLElement): void {
    viewport.addEventListener("pointerdown", (event) => {
      const target = event.target as Element | null;
      const pointerOverCard = Boolean(target?.closest(".ks-semantic-filter-card"));
      if (!shouldPanSemanticFilterViewport(event.button, pointerOverCard)) return;
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      viewport.addClass("is-panning");
      const start = { x: event.clientX, y: event.clientY, panX: this.pan.x, panY: this.pan.y };
      const move = (moveEvent: PointerEvent) => {
        this.pan = {
          x: start.panX + moveEvent.clientX - start.x,
          y: start.panY + moveEvent.clientY - start.y,
        };
        this.applyStageTransform(stage);
      };
      const finish = () => {
        viewport.removeClass("is-panning");
        viewport.removeEventListener("pointermove", move);
        viewport.removeEventListener("pointerup", finish);
        viewport.removeEventListener("pointercancel", finish);
      };
      viewport.addEventListener("pointermove", move);
      viewport.addEventListener("pointerup", finish);
      viewport.addEventListener("pointercancel", finish);
    });
    viewport.addEventListener("auxclick", (event) => {
      if (event.button === 1) event.preventDefault();
    });
    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const scene = {
        x: (pointer.x - this.pan.x) / this.zoom,
        y: (pointer.y - this.pan.y) / this.zoom,
      };
      const nextZoom = clampOverviewZoom(this.zoom * Math.exp(-event.deltaY * 0.0012), 1.8);
      this.pan = {
        x: pointer.x - scene.x * nextZoom,
        y: pointer.y - scene.y * nextZoom,
      };
      this.zoom = nextZoom;
      this.applyStageTransform(stage);
      this.updateZoomLabel(viewport);
    }, { passive: false });
  }

  private renderZoomControls(viewport: HTMLElement, stage: HTMLElement): void {
    const controls = viewport.createDiv({ cls: "ks-semantic-filter-zoom" });
    const addButton = (iconName: string, label: string, onClick: () => void) => {
      const button = controls.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": label },
      });
      setIcon(button, iconName);
      button.addEventListener("click", onClick);
    };
    addButton("minus", t("SEMANTIC_FILTER_ZOOM_OUT"), () => {
      this.zoom = clampOverviewZoom(this.zoom - 0.1, 1.8);
      this.applyStageTransform(stage);
      this.updateZoomLabel(viewport);
    });
    controls.createSpan({ cls: "ks-semantic-filter-zoom__label", text: `${Math.round(this.zoom * 100)}%` });
    addButton("plus", t("SEMANTIC_FILTER_ZOOM_IN"), () => {
      this.zoom = clampOverviewZoom(this.zoom + 0.1, 1.8);
      this.applyStageTransform(stage);
      this.updateZoomLabel(viewport);
    });
    addButton("focus", t("SEMANTIC_FILTER_ZOOM_RESET"), () => {
      this.zoom = 1;
      this.pan = { x: 0, y: 0 };
      this.applyStageTransform(stage);
      this.updateZoomLabel(viewport);
    });
  }

  private updateZoomLabel(viewport: HTMLElement): void {
    const label = viewport.querySelector<HTMLElement>(".ks-semantic-filter-zoom__label");
    if (label) label.setText(`${Math.round(this.zoom * 100)}%`);
  }

  private applyStageTransform(stage: HTMLElement): void {
    setStyle(stage, {
      transform: `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`,
    });
  }
}
