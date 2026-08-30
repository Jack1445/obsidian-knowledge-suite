import { Modal, Notice, type App } from "obsidian";
import type { SemanticUnitDefinition } from "./types";

export class SemanticUnitDeleteModal extends Modal {
  constructor(
    app: App,
    private readonly unit: SemanticUnitDefinition,
    private readonly instanceCount: number,
    private readonly onDelete: () => Promise<void>,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.modalEl.addClass("ks-field-action-modal", "ks-semantic-delete-modal");
    this.setTitle(`删除“${this.unit.name}”？`);
    this.contentEl.createEl("p", {
      text: this.instanceCount > 0
        ? `将删除该元素单位并解除 ${this.instanceCount} 个实例的语义关联。`
        : "将删除该元素单位定义。",
    });
    this.contentEl.createEl("p", {
      cls: "ks-semantic-delete-modal__assurance",
      text: "二维画布中的图形、文字、图片和文件节点都会原样保留，Markdown 与附件也不会被修改。",
    });
    const actions = this.contentEl.createDiv({ cls: "ks-field-action-modal__actions" });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-warning", text: "删除元素单位" });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      void this.onDelete()
        .then(() => this.close())
        .catch((error: unknown) => {
          confirm.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法删除元素单位。");
        });
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}
