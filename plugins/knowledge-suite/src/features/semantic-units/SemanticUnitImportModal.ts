import { Modal, Notice, setIcon } from "obsidian";
import type { SemanticUnitDefinition } from "./types";

export type SemanticUnitImportMode = "synchronized" | "independent";

type SemanticUnitImportValue = {
  unitId: string;
  copyName?: string;
};

export class SemanticUnitImportModal extends Modal {
  private selectedUnitId: string | null = null;
  private copyNameTouched = false;

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private readonly units: readonly SemanticUnitDefinition[],
    private readonly mode: SemanticUnitImportMode,
    private readonly suggestCopyName: (sourceName: string) => string,
    private readonly onSubmit: (value: SemanticUnitImportValue) => Promise<void>,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal", "ks-semantic-import-modal");
    this.setTitle(this.mode === "synchronized" ? "引入同步实例" : "创建独立副本");
    this.render();
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    const search = this.contentEl.createEl("input", {
      cls: "ks-semantic-import-modal__search",
      type: "search",
      placeholder: "搜索元素单位…",
      attr: { "aria-label": "搜索画布语义单位" },
    });
    const list = this.contentEl.createDiv({ cls: "ks-semantic-import-modal__list" });
    const copyNameWrap = this.contentEl.createDiv({ cls: "ks-semantic-import-modal__copy-name" });
    const copyName = copyNameWrap.createEl("input", {
      type: "text",
      placeholder: "副本名称",
      attr: { "aria-label": "独立副本名称" },
    });
    copyNameWrap.toggle(this.mode === "independent");
    copyName.addEventListener("input", () => {
      this.copyNameTouched = true;
    });

    const renderUnits = (): void => {
      list.empty();
      const query = search.value.trim().toLocaleLowerCase();
      const filtered = this.units.filter((unit) =>
        !query ||
        unit.name.toLocaleLowerCase().includes(query) ||
        unit.documentPath?.toLocaleLowerCase().includes(query),
      );
      for (const unit of filtered) {
        const row = list.createEl("button", {
          cls: "ks-semantic-import-modal__unit",
          attr: {
            type: "button",
            "aria-pressed": String(this.selectedUnitId === unit.id),
          },
        });
        row.toggleClass("is-selected", this.selectedUnitId === unit.id);
        const icon = row.createSpan({ cls: "ks-semantic-import-modal__unit-icon" });
        setIcon(icon, "boxes");
        const label = row.createSpan({ cls: "ks-semantic-import-modal__unit-label" });
        label.createSpan({ cls: "ks-semantic-import-modal__unit-name", text: unit.name });
        label.createSpan({
          cls: "ks-semantic-import-modal__unit-path",
          text: unit.documentPath ?? "无依托 Markdown",
        });
        const check = row.createSpan({ cls: "ks-semantic-import-modal__unit-check" });
        if (this.selectedUnitId === unit.id) setIcon(check, "check");
        row.addEventListener("click", () => {
          this.selectedUnitId = unit.id;
          if (this.mode === "independent" && !this.copyNameTouched) {
            copyName.value = this.suggestCopyName(unit.name);
          }
          renderUnits();
        });
      }
      if (filtered.length === 0) {
        list.createDiv({ cls: "ks-semantic-import-modal__empty", text: "没有匹配的元素单位" });
      }
    };
    search.addEventListener("input", renderUnits);
    renderUnits();

    const footer = this.contentEl.createDiv({ cls: "ks-metadata-modal__footer" });
    const cancel = footer.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const confirm = footer.createEl("button", {
      cls: "mod-cta",
      text: this.mode === "synchronized" ? "引入实例" : "创建副本",
    });
    confirm.addEventListener("click", () => {
      if (!this.selectedUnitId) {
        new Notice("请先选择一个元素单位。");
        return;
      }
      if (this.mode === "independent" && !copyName.value.trim()) {
        new Notice("独立副本名称不能为空。");
        copyName.focus();
        return;
      }
      confirm.disabled = true;
      void this.onSubmit({
        unitId: this.selectedUnitId,
        copyName: this.mode === "independent" ? copyName.value.trim() : undefined,
      }).then(() => this.close()).catch((error: unknown) => {
        confirm.disabled = false;
        new Notice(error instanceof Error ? error.message : "无法引入元素单位。");
      });
    });
    window.requestAnimationFrame(() => search.focus());
  }
}
