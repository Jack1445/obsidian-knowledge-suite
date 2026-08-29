import { MarkdownRenderChild, Notice, setIcon, TFile } from "obsidian";
import { setStyle } from "../../utils/styleUtils";
import type DocumentMetadataController from "./DocumentMetadataController";
import { hasDocumentFieldValue } from "./schema";
import type {
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentFieldValues,
} from "./types";

export class MarkdownFieldPanel extends MarkdownRenderChild {
  private unsubscribe: (() => void) | null = null;
  private renderGeneration = 0;

  constructor(
    containerEl: HTMLElement,
    private readonly sourcePath: string,
    private readonly controller: DocumentMetadataController,
    private readonly automatic = false,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.unsubscribe = this.controller.service.subscribe((filePath) => {
      if (!filePath || filePath === this.sourcePath) void this.render();
    });
    void this.render();
  }

  onunload(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.automatic) this.containerEl.remove();
  }

  private async render(): Promise<void> {
    const generation = ++this.renderGeneration;
    this.containerEl.empty();
    this.containerEl.addClass("ks-document-fields");
    this.containerEl.toggleClass("ks-document-fields--automatic", this.automatic);
    this.containerEl.show();
    const file = this.controller.app.vault.getFileByPath(this.sourcePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      this.renderError("无法找到当前 Markdown 文件。");
      return;
    }
    const fields = this.controller.service.getFields();
    let values: DocumentFieldValues;
    try {
      values = await this.controller.service.getValues(file, true);
    } catch (error: unknown) {
      this.renderError(error instanceof Error ? error.message : "无法读取字段块。");
      return;
    }
    if (generation !== this.renderGeneration) return;
    const visibleFields = fields.filter((field) => (
      field.defaultInDocument || hasDocumentFieldValue(values[field.key])
    ));

    if (visibleFields.length === 0) {
      this.containerEl.hide();
      return;
    }

    const header = this.containerEl.createDiv({ cls: "ks-document-fields__header" });
    const identity = header.createDiv({ cls: "ks-document-fields__identity" });
    const icon = identity.createSpan({ cls: "ks-document-fields__icon" });
    setIcon(icon, "tags");
    const title = identity.createDiv();
    title.createDiv({ cls: "ks-document-fields__title", text: "标签与属性" });
    title.createDiv({ cls: "ks-document-fields__subtitle", text: file.basename });
    const manageButton = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "打开标签与属性管理" },
    });
    setIcon(manageButton, "settings-2");
    manageButton.addEventListener("click", () => void this.controller.activateManager());

    const grid = this.containerEl.createDiv({ cls: "ks-document-fields__grid" });
    for (const field of visibleFields) {
      this.renderField(grid, file, field, values[field.key]);
    }
  }

  private renderField(
    grid: HTMLElement,
    file: TFile,
    field: DocumentFieldDefinition,
    value: DocumentFieldValue | undefined,
  ): void {
    const row = grid.createDiv({ cls: "ks-document-fields__row" });
    setStyle(row, { "--ks-field-accent": field.color ?? "var(--interactive-accent)" });
    const label = row.createDiv({ cls: "ks-document-fields__label" });
    label.createSpan({ cls: "ks-document-fields__dot" });
    label.createSpan({ text: field.name });
    const control = row.createDiv({ cls: "ks-document-fields__control" });
    const save = async (nextValue: DocumentFieldValue | undefined): Promise<void> => {
      row.addClass("is-saving");
      try {
        await this.controller.service.setFieldValue(file, field.id, nextValue);
      } catch (error: unknown) {
        new Notice(error instanceof Error ? error.message : "无法保存字段值。");
      } finally {
        row.removeClass("is-saving");
      }
    };

    if (field.type === "checkbox") {
      const checkboxLabel = control.createEl("label", { cls: "ks-document-fields__checkbox" });
      const checkbox = checkboxLabel.createEl("input", { type: "checkbox" });
      checkbox.checked = Boolean(value);
      checkboxLabel.createSpan({ text: checkbox.checked ? "是" : "否" });
      checkbox.addEventListener("change", () => {
        const text = checkboxLabel.querySelector("span");
        text?.setText(checkbox.checked ? "是" : "否");
        void save(checkbox.checked);
      });
      return;
    }

    if (field.type === "single-select") {
      const select = control.createEl("select", { cls: "dropdown" });
      select.createEl("option", { value: "", text: "未设置" });
      for (const option of field.options) select.createEl("option", { value: option, text: option });
      select.value = typeof value === "string" ? value : "";
      select.addEventListener("change", () => void save(select.value || undefined));
      return;
    }

    if (field.type === "multi-select") {
      const selected = new Set(Array.isArray(value) ? value : []);
      this.renderChips(control, selected, (next) => void save(next));
      const select = control.createEl("select", { cls: "dropdown ks-document-fields__add-select" });
      select.createEl("option", { value: "", text: "+ 添加选项" });
      for (const option of field.options.filter((candidate) => !selected.has(candidate))) {
        select.createEl("option", { value: option, text: option });
      }
      select.addEventListener("change", () => {
        if (!select.value) return;
        selected.add(select.value);
        void save([...selected]);
      });
      return;
    }

    if (field.type === "tags") {
      const selected = new Set(Array.isArray(value) ? value : []);
      this.renderChips(control, selected, (next) => void save(next));
      const input = control.createEl("input", {
        type: "text",
        cls: "ks-document-fields__tag-input",
        placeholder: "+ 添加标签",
        attr: { "aria-label": `为${field.name}添加标签` },
      });
      const commit = (): void => {
        const tags = input.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
        if (tags.length === 0) return;
        tags.forEach((tag) => selected.add(tag));
        input.value = "";
        void save([...selected]);
      };
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commit();
      });
      input.addEventListener("change", commit);
      return;
    }

    const input = control.createEl("input", {
      type: field.type === "number" ? "number" : field.type === "date" ? "date" : "text",
      cls: "ks-document-fields__input",
      placeholder: "未设置",
      attr: { "aria-label": `编辑${field.name}` },
    });
    input.value = value === undefined || value === null ? "" : String(value);
    input.addEventListener("change", () => void save(input.value || undefined));
  }

  private renderChips(
    control: HTMLElement,
    selected: Set<string>,
    onChange: (values: string[]) => void,
  ): void {
    for (const value of selected) {
      const chip = control.createSpan({ cls: "ks-document-fields__chip" });
      chip.createSpan({ text: value });
      const remove = chip.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": `移除 ${value}` },
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => {
        selected.delete(value);
        onChange([...selected]);
      });
    }
  }

  private renderError(message: string): void {
    const error = this.containerEl.createDiv({ cls: "ks-document-fields__error" });
    const icon = error.createSpan();
    setIcon(icon, "triangle-alert");
    error.createSpan({ text: message });
  }
}
