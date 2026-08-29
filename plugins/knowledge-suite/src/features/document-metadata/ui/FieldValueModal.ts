import { Modal, Notice, Setting, type App } from "obsidian";
import type { DocumentFieldDefinition, DocumentFieldValue } from "../types";

export class FieldValueModal extends Modal {
  constructor(
    app: App,
    private readonly field: DocumentFieldDefinition,
    private readonly initialValue: DocumentFieldValue | undefined,
    private readonly createsBlock: boolean,
    private readonly onSave: (value: DocumentFieldValue | undefined) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal", "ks-metadata-value-modal");
    this.setTitle(this.field.name);
    this.contentEl.createEl("p", {
      cls: "ks-metadata-modal__description",
      text: this.createsBlock
        ? "保存后会先备份原文件，再在正文中插入 Knowledge Suite 字段块。"
        : "修改只会更新正文中的 Knowledge Suite 字段块，并在写入前备份原文件。",
    });

    let value: DocumentFieldValue | undefined = this.initialValue;
    const editor = new Setting(this.contentEl).setName("字段值");
    switch (this.field.type) {
      case "checkbox":
        editor.addToggle((toggle) => toggle
          .setValue(Boolean(value))
          .onChange((next) => { value = next; }));
        break;
      case "single-select":
        editor.addDropdown((dropdown) => {
          dropdown.addOption("", "未设置");
          for (const option of this.field.options) dropdown.addOption(option, option);
          dropdown
            .setValue(typeof value === "string" ? value : "")
            .onChange((next) => { value = next || undefined; });
        });
        break;
      case "multi-select": {
        const selected = new Set(Array.isArray(value) ? value : []);
        editor.settingEl.addClass("ks-metadata-value-modal__multi");
        const optionsEl = editor.controlEl.createDiv({ cls: "ks-metadata-value-modal__options" });
        for (const option of this.field.options) {
          const label = optionsEl.createEl("label", { cls: "ks-metadata-choice" });
          const checkbox = label.createEl("input", { type: "checkbox" });
          checkbox.checked = selected.has(option);
          label.createSpan({ text: option });
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) selected.add(option);
            else selected.delete(option);
            value = [...selected];
          });
        }
        break;
      }
      case "tags":
        editor.addTextArea((textarea) => textarea
          .setPlaceholder("使用逗号或换行分隔多个标签")
          .setValue(Array.isArray(value) ? value.join(", ") : "")
          .onChange((next) => {
            value = next.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
          }));
        break;
      default:
        editor.addText((text) => {
          text
            .setPlaceholder(this.field.type === "date" ? "YYYY-MM-DD" : "输入字段值")
            .setValue(value === undefined || value === null ? "" : String(value))
            .onChange((next) => { value = next || undefined; });
          const input = text.inputEl;
          if (this.field.type === "number") input.type = "number";
          if (this.field.type === "date") input.type = "date";
        });
        break;
    }

    const actions = this.contentEl.createDiv({ cls: "ks-metadata-modal__actions" });
    const clearButton = actions.createEl("button", { text: "清空" });
    clearButton.addEventListener("click", () => {
      clearButton.disabled = true;
      void this.onSave(undefined)
        .then(() => this.close())
        .catch((error: unknown) => {
          clearButton.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法清空字段值。");
        });
    });
    const cancelButton = actions.createEl("button", { text: "取消" });
    cancelButton.addEventListener("click", () => this.close());
    const saveButton = actions.createEl("button", { cls: "mod-cta", text: "保存" });
    saveButton.addEventListener("click", () => {
      saveButton.disabled = true;
      void this.onSave(value)
        .then(() => this.close())
        .catch((error: unknown) => {
          saveButton.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法保存字段值。");
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
