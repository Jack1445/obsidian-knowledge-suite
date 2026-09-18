import { Modal, Notice, Setting, type App } from "obsidian";
import { t } from "../../lang/helpers";
import type { SemanticUnitDefinition } from "./types";

export class SemanticUnitRenameModal extends Modal {
  constructor(
    app: App,
    private readonly unit: SemanticUnitDefinition,
    private readonly onRename: (name: string) => Promise<void>,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal", "ks-semantic-rename-modal");
    this.setTitle(t("SEMANTIC_UNIT_RENAME_TITLE"));

    let name = this.unit.name;
    let nameInput: HTMLInputElement | null = null;
    const form = this.contentEl.createDiv({ cls: "ks-metadata-modal__form" });
    new Setting(form)
      .setName(t("SEMANTIC_UNIT_RENAME_FIELD"))
      .addText((text) => {
        text.setValue(name).onChange((value) => { name = value; });
        nameInput = text.inputEl;
      });

    const actions = this.contentEl.createDiv({ cls: "ks-metadata-modal__actions" });
    const cancelButton = actions.createEl("button", {
      text: t("SEMANTIC_UNIT_RENAME_CANCEL"),
    });
    cancelButton.addEventListener("click", () => this.close());
    const saveButton = actions.createEl("button", {
      cls: "mod-cta",
      text: t("SEMANTIC_UNIT_RENAME_CONFIRM"),
    });

    const submit = (): void => {
      if (saveButton.disabled) return;
      const normalizedName = name.trim();
      if (normalizedName === this.unit.name) {
        this.close();
        return;
      }
      saveButton.disabled = true;
      void this.onRename(normalizedName)
        .then(() => this.close())
        .catch((error: unknown) => {
          saveButton.disabled = false;
          new Notice(error instanceof Error
            ? error.message
            : t("SEMANTIC_UNIT_RENAME_FAILED"));
          nameInput?.focus();
          nameInput?.select();
        });
    };

    saveButton.addEventListener("click", submit);
    nameInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      submit();
    });
    (this.contentEl.ownerDocument.defaultView ?? window).requestAnimationFrame(() => {
      nameInput?.focus();
      nameInput?.select();
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}
