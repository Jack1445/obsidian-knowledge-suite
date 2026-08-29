import { ItemView, Menu, Notice, setIcon, type TFile, type WorkspaceLeaf } from "obsidian";
import { setStyle } from "../../../utils/styleUtils";
import type DocumentMetadataController from "../DocumentMetadataController";
import { FieldDefinitionModal } from "../ui/FieldDefinitionModal";
import {
  DeleteFieldModal,
  FieldColorModal,
  FieldTypeModal,
} from "../ui/FieldContextModals";
import { FieldValueModal } from "../ui/FieldValueModal";
import { FilterBuilderModal } from "../ui/FilterBuilderModal";
import type {
  CreateDocumentFieldInput,
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentFieldValues,
} from "../types";

export const DOCUMENT_METADATA_MANAGER_VIEW_TYPE = "knowledge-suite-document-metadata-manager";
const PAGE_SIZE = 100;
const MANAGER_FILTER_CONTEXT = "document-manager";

export class DocumentMetadataManagerView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private refreshTimer: number | null = null;
  private renderGeneration = 0;
  private search = "";
  private folder = "/";
  private page = 0;
  private restoreSearchFocus = false;
  private draggedFieldId: string | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly controller: DocumentMetadataController) {
    super(leaf);
  }

  getViewType(): string {
    return DOCUMENT_METADATA_MANAGER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "标签与属性管理";
  }

  getIcon(): string {
    return "table-properties";
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.controller.service.subscribe(() => this.scheduleRender());
    await this.render();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.draggedFieldId = null;
  }

  private scheduleRender(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.render();
    }, 120);
  }

  private async render(): Promise<void> {
    const generation = ++this.renderGeneration;
    this.contentEl.empty();
    this.contentEl.addClass("ks-metadata-manager");
    const fields = this.controller.service.getFields();
    const allFiles = this.controller.service.getMarkdownFiles();

    const header = this.contentEl.createDiv({ cls: "ks-metadata-manager__header" });
    const identity = header.createDiv({ cls: "ks-metadata-manager__identity" });
    const icon = identity.createDiv({ cls: "ks-metadata-manager__icon" });
    setIcon(icon, "table-properties");
    const titleGroup = identity.createDiv();
    titleGroup.createEl("h2", { text: "标签与属性管理" });
    titleGroup.createEl("p", {
      text: `${allFiles.length} 份 Markdown · ${fields.length} 个字段`,
    });
    const headerActions = header.createDiv({ cls: "ks-metadata-manager__header-actions" });
    const refreshButton = headerActions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "刷新元数据" },
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", () => void this.render());
    const addButton = headerActions.createEl("button", {
      cls: "mod-cta ks-metadata-manager__add-field",
      text: "新建字段",
    });
    const addIcon = addButton.createSpan({ cls: "ks-metadata-manager__button-icon" });
    setIcon(addIcon, "plus");
    addButton.addEventListener("click", () => this.openCreateField());

    const toolbar = this.contentEl.createDiv({ cls: "ks-metadata-manager__toolbar" });
    const searchWrap = toolbar.createDiv({ cls: "ks-metadata-manager__search" });
    const searchIcon = searchWrap.createSpan();
    setIcon(searchIcon, "search");
    const searchInput = searchWrap.createEl("input", {
      type: "search",
      placeholder: "搜索文件名或路径…",
      attr: { "aria-label": "搜索 Markdown 文件" },
    });
    searchInput.value = this.search;
    if (this.restoreSearchFocus) {
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      });
    }
    searchInput.addEventListener("blur", () => { this.restoreSearchFocus = false; });
    searchInput.addEventListener("input", () => {
      this.search = searchInput.value;
      this.page = 0;
      this.restoreSearchFocus = true;
      this.scheduleRender();
    });

    const folderSelect = toolbar.createEl("select", {
      cls: "dropdown ks-metadata-manager__folder",
      attr: { "aria-label": "按文件夹筛选" },
    });
    folderSelect.createEl("option", { value: "/", text: "全部文件夹" });
    const folders = [...new Set(allFiles.map((file) => file.parent?.path || "/"))]
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    for (const path of folders) {
      if (path === "/") continue;
      folderSelect.createEl("option", { value: path, text: path });
    }
    folderSelect.value = this.folder;
    folderSelect.addEventListener("change", () => {
      this.folder = folderSelect.value;
      this.page = 0;
      void this.render();
    });
    const activeFilter = this.controller.service.getSavedFilter(MANAGER_FILTER_CONTEXT);
    const filterButton = toolbar.createEl("button", {
      cls: "ks-metadata-manager__filter-button",
      attr: { "aria-label": "设置字段筛选条件" },
    });
    const filterIcon = filterButton.createSpan();
    setIcon(filterIcon, "list-filter");
    filterButton.createSpan({ text: "筛选" });
    if (activeFilter.conditions.length > 0) {
      filterButton.addClass("is-active");
      filterButton.createSpan({
        cls: "ks-metadata-manager__filter-count",
        text: String(activeFilter.conditions.length),
      });
    }
    filterButton.addEventListener("click", () => {
      new FilterBuilderModal(this.app, fields, activeFilter, async (filter) => {
        await this.controller.service.saveFilter(MANAGER_FILTER_CONTEXT, filter);
        this.page = 0;
      }).open();
    });

    if (fields.length === 0) {
      this.renderEmptyState();
      return;
    }

    const normalizedSearch = this.search.trim().toLocaleLowerCase();
    let filteredFiles = allFiles.filter((file) => {
      const folderMatches = this.folder === "/" || file.path.startsWith(`${this.folder}/`);
      const searchMatches = !normalizedSearch || file.path.toLocaleLowerCase().includes(normalizedSearch);
      return folderMatches && searchMatches;
    });
    if (activeFilter.conditions.length > 0) {
      filteredFiles = await this.controller.service.filterFiles(filteredFiles, activeFilter);
      if (generation !== this.renderGeneration) return;
    }
    const pageCount = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
    this.page = Math.min(this.page, pageCount - 1);
    const pageFiles = filteredFiles.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);

    const tableShell = this.contentEl.createDiv({ cls: "ks-metadata-manager__table-shell" });
    const table = tableShell.createEl("table", { cls: "ks-metadata-manager__table" });
    const columns = table.createEl("colgroup");
    const fileColumn = columns.createEl("col");
    const fileColumnWidth = this.controller.service.getFileColumnWidth();
    setStyle(fileColumn, { width: `${fileColumnWidth}px` });
    const fieldColumns = new Map<string, HTMLTableColElement>();
    for (const field of fields) {
      const column = columns.createEl("col");
      setStyle(column, { width: `${this.controller.service.getFieldColumnWidth(field.id)}px` });
      fieldColumns.set(field.id, column);
    }
    columns.createEl("col", { cls: "ks-metadata-manager__spacer-column" });
    const tableWidth = fileColumnWidth + fields.reduce(
      (total, field) => total + this.controller.service.getFieldColumnWidth(field.id),
      0,
    );
    setStyle(table, { width: `max(100%, ${tableWidth}px)` });
    const head = table.createEl("thead").createEl("tr");
    const fieldHeaders = new Map<string, HTMLTableCellElement>();
    const fileHeader = head.createEl("th", { cls: "ks-metadata-manager__file-column", text: "文档" });
    this.attachColumnResize(
      fileHeader,
      fileColumn,
      fileColumnWidth,
      56,
      480,
      (width) => this.controller.service.setFileColumnWidth(width),
    );
    for (const field of fields) {
      const column = fieldColumns.get(field.id);
      if (column) fieldHeaders.set(field.id, this.renderFieldHeader(head, field, column));
    }
    head.createEl("th", { cls: "ks-metadata-manager__spacer-cell" });
    const body = table.createEl("tbody");
    const rows: Array<{
      file: TFile;
      values: DocumentFieldValues;
      error: Error | null;
    }> = await Promise.all(pageFiles.map(async (file): Promise<{
      file: TFile;
      values: DocumentFieldValues;
      error: Error | null;
    }> => {
      try {
        return { file, values: await this.controller.service.getValues(file), error: null };
      } catch (error: unknown) {
        return {
          file,
          values: {},
          error: error instanceof Error ? error : new Error("无法解析字段块。"),
        };
      }
    }));
    if (generation !== this.renderGeneration) return;
    if (rows.length === 0) {
      const row = body.createEl("tr");
      row.createEl("td", {
        cls: "ks-metadata-manager__table-empty",
        text: "没有符合当前条件的 Markdown 文件",
        attr: { colspan: String(fields.length + 2) },
      });
    }
    for (const record of rows) {
      const row = body.createEl("tr");
      const fileCell = row.createEl("td", { cls: "ks-metadata-manager__file-cell" });
      const fileButton = fileCell.createEl("button", {
        cls: "ks-metadata-manager__file-button",
        attr: { "aria-label": `打开文档：${record.file.basename}` },
      });
      const fileIcon = fileButton.createSpan();
      setIcon(fileIcon, record.error ? "triangle-alert" : "file-text");
      fileButton.createSpan({ cls: "ks-metadata-manager__file-name", text: record.file.basename });
      fileButton.addEventListener("click", () => void this.app.workspace.getLeaf(false).openFile(record.file));
      for (const field of fields) {
        const cell = row.createEl("td", { cls: "ks-metadata-manager__value-cell" });
        const fieldHeader = fieldHeaders.get(field.id);
        if (fieldHeader) this.attachFieldDropTarget(cell, fieldHeader, field);
        if (record.error) {
          cell.createSpan({ cls: "ks-metadata-manager__error", text: "无法解析" });
          continue;
        }
        this.renderValueButton(cell, record.file, field, record.values[field.key]);
      }
      row.createEl("td", { cls: "ks-metadata-manager__spacer-cell" });
    }

    this.renderPagination(filteredFiles.length, pageCount);
  }

  private renderFieldHeader(
    row: HTMLTableRowElement,
    field: DocumentFieldDefinition,
    column: HTMLTableColElement,
  ): HTMLTableCellElement {
    const cell = row.createEl("th", { cls: "ks-metadata-manager__field-column" });
    cell.draggable = true;
    const button = cell.createEl("button", {
      cls: "ks-metadata-manager__field-header",
      attr: { "aria-label": `字段菜单：${field.name}` },
    });
    button.draggable = true;
    setStyle(button, { "--ks-field-accent": field.color ?? "var(--interactive-accent)" });
    button.createSpan({ cls: "ks-metadata-manager__field-dot" });
    const text = button.createSpan({ cls: "ks-metadata-manager__field-title" });
    text.createSpan({ text: field.name });
    const settingsIcon = button.createSpan({ cls: "ks-metadata-manager__field-settings" });
    setIcon(settingsIcon, "grip-vertical");
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.startFieldNameEdit(cell, button, text, field);
    });
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.showFieldMenu(event, field);
    });
    cell.addEventListener("dragstart", (event) => {
      this.draggedFieldId = field.id;
      cell.addClass("is-dragging");
      event.dataTransfer?.setData("application/x-knowledge-suite-field", field.id);
      event.dataTransfer?.setData("text/plain", field.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setDragImage(button, 20, 16);
      }
    });
    this.attachFieldDropTarget(cell, cell, field);
    cell.addEventListener("dragend", () => {
      this.draggedFieldId = null;
      cell.removeClass("is-dragging");
      for (const header of row.querySelectorAll(".ks-metadata-manager__field-column")) {
        header.removeClass("is-drop-before", "is-drop-after");
      }
    });
    this.attachColumnResize(
      cell,
      column,
      this.controller.service.getFieldColumnWidth(field.id),
      120,
      480,
      (width) => this.controller.service.setFieldColumnWidth(field.id, width),
    );
    return cell;
  }

  private attachFieldDropTarget(
    target: HTMLElement,
    header: HTMLTableCellElement,
    field: DocumentFieldDefinition,
  ): void {
    const getPosition = (clientX: number): "before" | "after" => {
      const bounds = header.getBoundingClientRect();
      return clientX < bounds.left + bounds.width / 2 ? "before" : "after";
    };
    target.addEventListener("dragover", (event) => {
      const sourceId = this.draggedFieldId;
      if (!sourceId || sourceId === field.id) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.clearFieldDropIndicators();
      const position = getPosition(event.clientX);
      header.toggleClass("is-drop-before", position === "before");
      header.toggleClass("is-drop-after", position === "after");
    });
    target.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      header.removeClass("is-drop-before", "is-drop-after");
    });
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = this.draggedFieldId;
      const position = getPosition(event.clientX);
      this.clearFieldDropIndicators();
      if (!sourceId || sourceId === field.id) return;
      this.draggedFieldId = null;
      void this.controller.service.reorderField(sourceId, field.id, position)
        .catch((error: unknown) => {
          new Notice(error instanceof Error ? error.message : "无法调整字段顺序。");
        });
    });
  }

  private clearFieldDropIndicators(): void {
    for (const header of this.contentEl.querySelectorAll(".ks-metadata-manager__field-column")) {
      header.removeClass("is-drop-before", "is-drop-after");
    }
  }

  private attachColumnResize(
    header: HTMLTableCellElement,
    column: HTMLTableColElement,
    initialWidth: number,
    minimum: number,
    maximum: number,
    persist: (width: number) => Promise<void>,
  ): void {
    const handle = header.createDiv({
      cls: "ks-metadata-manager__resize-handle",
      attr: { "aria-label": "拖动调整列宽" },
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      let width = initialWidth;
      handle.setPointerCapture(event.pointerId);
      header.addClass("is-resizing");
      const onMove = (moveEvent: PointerEvent): void => {
        width = Math.round(Math.min(maximum, Math.max(minimum, initialWidth + moveEvent.clientX - startX)));
        setStyle(column, { width: `${width}px` });
        const table = column.closest("table");
        const group = column.parentElement;
        if (table && group) {
          const total = Array.from(group.children)
            .filter((element) => !element.hasClass("ks-metadata-manager__spacer-column"))
            .reduce((sum, element) => {
            const value = Number.parseFloat((element as HTMLElement).style.width);
            return sum + (Number.isFinite(value) ? value : 0);
            }, 0);
          setStyle(table, { width: `max(100%, ${Math.round(total)}px)` });
        }
      };
      const onUp = (upEvent: PointerEvent): void => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        header.removeClass("is-resizing");
        void persist(width).catch((error: unknown) => {
          new Notice(error instanceof Error ? error.message : "无法保存列宽。");
        });
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  private renderValueButton(
    cell: HTMLTableCellElement,
    file: TFile,
    field: DocumentFieldDefinition,
    value: DocumentFieldValue | undefined,
  ): void {
    const button = cell.createEl("button", {
      cls: "ks-metadata-manager__value-button",
      attr: { "aria-label": `编辑 ${file.basename} 的${field.name}` },
    });
    setStyle(button, { "--ks-field-accent": field.color ?? "var(--interactive-accent)" });
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      button.addClass("is-empty");
      const plus = button.createSpan();
      setIcon(plus, "plus");
      button.createSpan({ text: "设置" });
    } else if (field.type === "checkbox") {
      const stateIcon = button.createSpan();
      setIcon(stateIcon, value ? "circle-check" : "circle");
      button.createSpan({ text: value ? "是" : "否" });
    } else if (Array.isArray(value)) {
      const shown = value.slice(0, 2);
      for (const item of shown) button.createSpan({ cls: "ks-metadata-chip", text: item });
      if (value.length > shown.length) {
        button.createSpan({ cls: "ks-metadata-chip is-count", text: `+${value.length - shown.length}` });
      }
    } else {
      button.createSpan({ cls: "ks-metadata-manager__scalar", text: String(value) });
    }
    button.addEventListener("click", () => {
      void this.controller.service.hasFieldBlock(file).then((hasBlock) => {
        new FieldValueModal(this.app, field, value, !hasBlock, async (nextValue) => {
          await this.controller.service.setFieldValue(file, field.id, nextValue);
          new Notice("字段已更新，原文件备份已保留。");
        }).open();
      });
    });
  }

  private renderPagination(total: number, pageCount: number): void {
    const footer = this.contentEl.createDiv({ cls: "ks-metadata-manager__footer" });
    const start = total === 0 ? 0 : this.page * PAGE_SIZE + 1;
    const end = Math.min(total, (this.page + 1) * PAGE_SIZE);
    footer.createSpan({ text: `显示 ${start}–${end}，共 ${total} 份文档` });
    const actions = footer.createDiv({ cls: "ks-metadata-manager__pagination" });
    const previous = actions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "上一页" },
    });
    setIcon(previous, "chevron-left");
    previous.disabled = this.page === 0;
    previous.addEventListener("click", () => {
      this.page -= 1;
      void this.render();
    });
    actions.createSpan({ text: `${this.page + 1} / ${pageCount}` });
    const next = actions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "下一页" },
    });
    setIcon(next, "chevron-right");
    next.disabled = this.page >= pageCount - 1;
    next.addEventListener("click", () => {
      this.page += 1;
      void this.render();
    });
  }

  private renderEmptyState(): void {
    const empty = this.contentEl.createDiv({ cls: "ks-metadata-manager__empty" });
    const artwork = empty.createDiv({ cls: "ks-metadata-manager__empty-artwork" });
    setIcon(artwork, "list-plus");
    empty.createEl("h3", { text: "建立你的第一列" });
    empty.createEl("p", {
      text: "字段定义只需建立一次，之后即可在所有 Markdown 文档的正文面板和管理表格中使用。",
    });
    const button = empty.createEl("button", { cls: "mod-cta", text: "新建字段" });
    button.addEventListener("click", () => this.openCreateField());
  }

  private openCreateField(): void {
    new FieldDefinitionModal(this.app, null, async (value) => {
      await this.controller.service.createField(value as CreateDocumentFieldInput);
    }).open();
  }

  private openEditField(field: DocumentFieldDefinition): void {
    new FieldDefinitionModal(
      this.app,
      field,
      async (value) => this.controller.service.updateField(field.id, value),
    ).open();
  }

  private startFieldNameEdit(
    cell: HTMLTableCellElement,
    button: HTMLButtonElement,
    title: HTMLSpanElement,
    field: DocumentFieldDefinition,
  ): void {
    if (button.hasClass("is-editing")) return;
    button.addClass("is-editing");
    cell.draggable = false;
    button.draggable = false;
    title.empty();
    const input = title.createEl("input", {
      cls: "ks-metadata-manager__field-name-input",
      type: "text",
      value: field.name,
      attr: { "aria-label": "字段名称" },
    });
    let settled = false;
    const restore = (name: string): void => {
      if (!button.isConnected) return;
      title.empty();
      title.createSpan({ text: name });
      button.removeClass("is-editing");
      cell.draggable = true;
      button.draggable = true;
    };
    const finish = async (save: boolean): Promise<void> => {
      if (settled) return;
      const name = input.value.trim();
      if (save && !name) {
        new Notice("字段名称不能为空。");
        input.focus();
        return;
      }
      settled = true;
      if (!save || name === field.name) {
        restore(field.name);
        return;
      }
      input.disabled = true;
      try {
        await this.controller.service.updateField(field.id, { name });
        restore(name);
      } catch (error: unknown) {
        new Notice(error instanceof Error ? error.message : "无法修改字段名称。");
        restore(field.name);
      }
    };
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        void finish(false);
      }
    });
    input.addEventListener("blur", () => void finish(true));
    input.focus();
    input.select();
  }

  private showFieldMenu(event: MouseEvent, field: DocumentFieldDefinition): void {
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle("编辑字段")
      .setIcon("pencil")
      .setSection("knowledge-suite-field-action")
      .onClick(() => this.openEditField(field)));
    menu.addItem((item) => item
      .setTitle("设置颜色")
      .setIcon("palette")
      .setSection("knowledge-suite-field-action")
      .onClick(() => new FieldColorModal(
        this.app,
        field,
        async (color) => this.controller.service.updateField(field.id, { color }),
      ).open()));
    menu.addItem((item) => item
      .setTitle("更改字段类型")
      .setIcon("list-tree")
      .setSection("knowledge-suite-field-action")
      .onClick(() => new FieldTypeModal(
        this.app,
        field,
        async (type) => this.controller.service.updateField(field.id, { type }),
      ).open()));
    menu.addItem((item) => item
      .setTitle("设为默认属性")
      .setIcon("circle-check")
      .setChecked(field.defaultInDocument)
      .setSection("knowledge-suite-field-action")
      .onClick(() => {
        void this.controller.service.updateField(field.id, {
          defaultInDocument: !field.defaultInDocument,
        }).catch((error: unknown) => {
          new Notice(error instanceof Error ? error.message : "无法更新默认属性。");
        });
      }));
    menu.addSeparator();
    menu.addItem((item) => item
      .setTitle("删除字段")
      .setIcon("trash-2")
      .setWarning(true)
      .setSection("knowledge-suite-field-danger")
      .onClick(() => new DeleteFieldModal(this.app, field, async () => {
        await this.controller.service.deleteField(field.id);
        new Notice("字段定义已删除；Markdown 中的已有值未被改动。");
      }).open()));
    menu.showAtMouseEvent(event);
  }

}
