import { Modal, Notice, Setting, type App } from "obsidian";
import {
  DOCUMENT_FIELD_TYPE_LABELS,
  type CreateDocumentFieldInput,
  type DocumentFieldDefinition,
  type DocumentFieldType,
  type UpdateDocumentFieldInput,
} from "../types";

type FieldDefinitionSubmit = CreateDocumentFieldInput | UpdateDocumentFieldInput;

export class FieldDefinitionModal extends Modal {
  constructor(
    app: App,
    private readonly existing: DocumentFieldDefinition | null,
    private readonly onSubmit: (value: FieldDefinitionSubmit) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal");
    this.setTitle(this.existing ? "编辑字段" : "新建字段");

    let name = this.existing?.name ?? "";
    let type: DocumentFieldType = this.existing?.type ?? "text";
    let options = this.existing?.options.join("\n") ?? "";
    const form = this.contentEl.createDiv({ cls: "ks-metadata-modal__form" });

    new Setting(form)
      .setName("字段名称")
      .addText((text) => text
        .setPlaceholder("例如：发表状态")
        .setValue(name)
        .onChange((value) => { name = value; }));

    let optionsSetting: Setting;
    const updateOptionsVisibility = (): void => {
      optionsSetting?.settingEl.toggle(["single-select", "multi-select"].includes(type));
    };
    if (!this.existing) {
      new Setting(form)
        .setName("字段类型")
        .addDropdown((dropdown) => {
          for (const [value, label] of Object.entries(DOCUMENT_FIELD_TYPE_LABELS)) {
            dropdown.addOption(value, label);
          }
          dropdown
            .setValue(type)
            .onChange((value) => {
              type = value as DocumentFieldType;
              updateOptionsVisibility();
            });
        });
    }

    optionsSetting = new Setting(form)
      .setName("候选项")
      .addTextArea((textarea) => textarea
        .setPlaceholder("阅读中\n审稿中\n已发表")
        .setValue(options)
        .onChange((value) => { options = value; }));
    optionsSetting.settingEl.addClass("ks-metadata-modal__options-row");
    updateOptionsVisibility();

    const actions = this.contentEl.createDiv({ cls: "ks-metadata-modal__actions" });
    const cancelButton = actions.createEl("button", { text: "取消" });
    cancelButton.addEventListener("click", () => this.close());
    const saveButton = actions.createEl("button", {
      cls: "mod-cta",
      text: this.existing ? "保存修改" : "建立字段",
    });
    saveButton.addEventListener("click", () => {
      saveButton.disabled = true;
      const optionValues = options.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      const value: FieldDefinitionSubmit = this.existing
        ? { name, options: optionValues }
        : { name, type, options: optionValues };
      void this.onSubmit(value)
        .then(() => this.close())
        .catch((error: unknown) => {
          saveButton.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法保存字段。");
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
