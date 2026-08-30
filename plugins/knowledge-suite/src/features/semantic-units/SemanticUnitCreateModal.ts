import { Modal, Notice, Setting, setIcon, type App, type TFile } from "obsidian";
import { SemanticMarkdownPickerModal } from "./SemanticMarkdownPickerModal";

export type SemanticUnitCreateValue = {
  name: string;
  documentPath: string | null;
};

export class SemanticUnitCreateModal extends Modal {
  constructor(
    app: App,
    private readonly isEligibleMarkdown: (file: TFile) => boolean,
    private readonly onSubmit: (value: SemanticUnitCreateValue) => Promise<void>,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal", "ks-semantic-create-modal");
    this.setTitle("建立画布语义单位");
    let name = "";
    let documentPath: string | null = null;
    const form = this.contentEl.createDiv({ cls: "ks-metadata-modal__form" });
    const nameSetting = new Setting(form)
      .setName("单位名称")
      .addText((text) => text
        .setPlaceholder("例如：触觉方法概览")
        .onChange((value) => { name = value; }));
    const nameInput = nameSetting.controlEl.querySelector("input");
    const documentSetting = new Setting(form).setName("依托 Markdown");
    const documentButton = documentSetting.controlEl.createEl("button", {
      cls: "ks-semantic-create-modal__document-button",
      attr: { "aria-label": "选择依托 Markdown" },
    });
    const documentIcon = documentButton.createSpan();
    setIcon(documentIcon, "file-search");
    const documentLabel = documentButton.createSpan({
      cls: "ks-semantic-create-modal__document-label",
      text: "无依托 Markdown",
    });
    const documentChevron = documentButton.createSpan();
    setIcon(documentChevron, "chevron-right");
    const updateDocumentLabel = (): void => {
      documentLabel.setText(documentPath ?? "无依托 Markdown");
      documentButton.toggleClass("has-selection", Boolean(documentPath));
    };
    documentButton.addEventListener("click", () => {
      new SemanticMarkdownPickerModal(
        this.app,
        documentPath,
        this.isEligibleMarkdown,
        (path) => {
          documentPath = path;
          updateDocumentLabel();
        },
      ).open();
    });
    const actions = this.contentEl.createDiv({ cls: "ks-metadata-modal__actions" });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-cta", text: "建立单位" });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      void this.onSubmit({ name, documentPath })
        .then(() => this.close())
        .catch((error: unknown) => {
          confirm.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法建立语义单位。");
        });
    });
    window.requestAnimationFrame(() => nameInput?.focus());
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}
