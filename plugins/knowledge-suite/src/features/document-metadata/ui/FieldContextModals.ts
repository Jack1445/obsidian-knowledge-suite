import { ColorComponent, Modal, Notice, setIcon, type App } from "obsidian";
import { setStyle } from "../../../utils/styleUtils";
import {
  DOCUMENT_FIELD_TYPE_LABELS,
  type DocumentFieldDefinition,
  type DocumentFieldType,
} from "../types";

const FIELD_COLORS = [
  { name: "紫色", value: "#7c6df2" },
  { name: "蓝色", value: "#4f8cff" },
  { name: "青色", value: "#28a9bf" },
  { name: "绿色", value: "#21a179" },
  { name: "黄色", value: "#d19a24" },
  { name: "橙色", value: "#e07038" },
  { name: "红色", value: "#d95763" },
  { name: "灰色", value: "#64748b" },
] as const;

export class FieldColorModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private readonly field: DocumentFieldDefinition,
    private readonly onSubmit: (value: string) => Promise<void>,
  ) {
    super(app);
    this.value = field.color ?? FIELD_COLORS[0].value;
  }

  onOpen(): void {
    this.modalEl.addClass("ks-field-action-modal");
    this.setTitle("字段颜色");
    const palette = this.contentEl.createDiv({ cls: "ks-field-color-grid" });
    const renderSelection = (): void => {
      for (const button of palette.querySelectorAll<HTMLButtonElement>("button")) {
        button.toggleClass("is-selected", button.dataset.color === this.value);
      }
    };
    for (const color of FIELD_COLORS) {
      const button = palette.createEl("button", {
        cls: "ks-field-color-swatch",
        attr: { "aria-label": color.name },
      });
      button.dataset.color = color.value;
      const dot = button.createSpan({ cls: "ks-field-color-swatch__dot" });
      setStyle(dot, { backgroundColor: color.value });
      button.createSpan({ cls: "ks-field-color-swatch__name", text: color.name });
      const check = button.createSpan({ cls: "ks-field-color-swatch__check" });
      setIcon(check, "check");
      button.addEventListener("click", () => {
        this.value = color.value;
        picker.setValue(color.value);
        renderSelection();
      });
    }
    const custom = this.contentEl.createDiv({ cls: "ks-field-color-custom" });
    const customLabel = custom.createDiv({ cls: "ks-field-color-custom__label" });
    const customIcon = customLabel.createSpan();
    setIcon(customIcon, "pipette");
    customLabel.createSpan({ text: "自定义颜色" });
    const picker = new ColorComponent(custom)
      .setValue(this.value)
      .onChange((value) => {
        this.value = value;
        renderSelection();
      });
    renderSelection();
    this.renderActions("应用颜色", async () => this.onSubmit(this.value));
  }

  private renderActions(label: string, submit: () => Promise<void>): void {
    const actions = this.contentEl.createDiv({ cls: "ks-field-action-modal__actions" });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { cls: "mod-cta", text: label });
    apply.addEventListener("click", () => {
      apply.disabled = true;
      void submit()
        .then(() => this.close())
        .catch((error: unknown) => {
          apply.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法更新字段颜色。");
        });
    });
  }
}

export class FieldTypeModal extends Modal {
  constructor(
    app: App,
    private readonly field: DocumentFieldDefinition,
    private readonly onSubmit: (value: DocumentFieldType) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("ks-field-action-modal");
    this.setTitle("字段类型");
    const grid = this.contentEl.createDiv({ cls: "ks-field-type-grid" });
    for (const [value, label] of Object.entries(DOCUMENT_FIELD_TYPE_LABELS)) {
      const type = value as DocumentFieldType;
      const button = grid.createEl("button", {
        cls: "ks-field-type-option",
        text: label,
      });
      button.toggleClass("is-selected", type === this.field.type);
      if (type === this.field.type) {
        const check = button.createSpan();
        setIcon(check, "check");
      }
      button.addEventListener("click", () => {
        button.disabled = true;
        void this.onSubmit(type)
          .then(() => this.close())
          .catch((error: unknown) => {
            button.disabled = false;
            new Notice(error instanceof Error ? error.message : "无法更改字段类型。");
          });
      });
    }
  }
}

export class DeleteFieldModal extends Modal {
  constructor(
    app: App,
    private readonly field: DocumentFieldDefinition,
    private readonly onDelete: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("ks-field-action-modal", "ks-field-delete-modal");
    this.setTitle(`删除“${this.field.name}”？`);
    this.contentEl.createEl("p", {
      text: "字段定义会被删除，Markdown 中已经保存的旧值保持不变。",
    });
    const actions = this.contentEl.createDiv({ cls: "ks-field-action-modal__actions" });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-warning", text: "删除字段" });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      void this.onDelete()
        .then(() => this.close())
        .catch((error: unknown) => {
          confirm.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法删除字段。");
        });
    });
  }
}
