import { Modal, Notice, setIcon, type App } from "obsidian";
import type {
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentFilterCondition,
  DocumentFilterDefinition,
  DocumentFilterOperator,
} from "../types";

const OPERATOR_LABELS: Record<DocumentFilterOperator, string> = {
  equals: "等于",
  "not-equals": "不等于",
  contains: "包含",
  "not-contains": "不包含",
  "greater-than": "大于",
  "less-than": "小于",
  "is-empty": "为空",
  "is-not-empty": "不为空",
};

export class FilterBuilderModal extends Modal {
  private filter: DocumentFilterDefinition;
  private conditionsEl!: HTMLElement;
  private conditionCountEl!: HTMLElement;

  constructor(
    app: App,
    private readonly fields: DocumentFieldDefinition[],
    initial: DocumentFilterDefinition,
    private readonly onSave: (filter: DocumentFilterDefinition) => Promise<void>,
    private readonly copy: { title?: string; description?: string } = {},
  ) {
    super(app);
    this.filter = JSON.parse(JSON.stringify(initial)) as DocumentFilterDefinition;
  }

  onOpen(): void {
    this.modalEl.addClass("ks-metadata-modal", "ks-filter-modal");
    this.setTitle(this.copy.title ?? "筛选 Markdown 文档");
    const introduction = this.contentEl.createDiv({ cls: "ks-filter-modal__intro" });
    const introIcon = introduction.createSpan({ cls: "ks-filter-modal__intro-icon" });
    setIcon(introIcon, "list-filter");
    introduction.createEl("p", {
      cls: "ks-metadata-modal__description",
      text: this.copy.description ?? "这套筛选定义由统一元数据服务保存，未来可以直接复用于二维和三维画布。",
    });

    const logic = this.contentEl.createDiv({ cls: "ks-filter-modal__logic" });
    const logicCopy = logic.createDiv({ cls: "ks-filter-modal__logic-copy" });
    logicCopy.createDiv({ cls: "ks-filter-modal__logic-title", text: "条件关系" });
    logicCopy.createDiv({ cls: "ks-filter-modal__logic-hint", text: "多个条件如何组合" });
    const segments = logic.createDiv({ cls: "ks-filter-modal__segments" });
    const allButton = segments.createEl("button", { text: "全部", attr: { type: "button" } });
    const anyButton = segments.createEl("button", { text: "任一", attr: { type: "button" } });
    const updateSegments = (): void => {
      allButton.toggleClass("is-selected", this.filter.match === "all");
      anyButton.toggleClass("is-selected", this.filter.match === "any");
      allButton.setAttr("aria-pressed", String(this.filter.match === "all"));
      anyButton.setAttr("aria-pressed", String(this.filter.match === "any"));
    };
    allButton.addEventListener("click", () => {
      this.filter.match = "all";
      updateSegments();
    });
    anyButton.addEventListener("click", () => {
      this.filter.match = "any";
      updateSegments();
    });
    updateSegments();

    const section = this.contentEl.createDiv({ cls: "ks-filter-modal__section" });
    const sectionHeader = section.createDiv({ cls: "ks-filter-modal__section-header" });
    const sectionIdentity = sectionHeader.createDiv({ cls: "ks-filter-modal__section-identity" });
    sectionIdentity.createDiv({ text: "筛选条件" });
    this.conditionCountEl = sectionIdentity.createSpan({ cls: "ks-filter-modal__count" });
    const addButton = sectionHeader.createEl("button", {
      cls: "ks-filter-modal__add",
      attr: { type: "button", "aria-label": "添加筛选条件" },
    });
    setIcon(addButton, "plus");
    addButton.createSpan({ text: "添加条件" });
    addButton.addEventListener("click", () => this.addCondition());
    this.conditionsEl = section.createDiv({ cls: "ks-filter-modal__conditions" });
    this.renderConditions();

    const actions = this.contentEl.createDiv({ cls: "ks-metadata-modal__actions" });
    const clearButton = actions.createEl("button", { cls: "ks-filter-modal__clear", text: "清除筛选" });
    clearButton.addEventListener("click", () => {
      clearButton.disabled = true;
      void this.onSave({ match: "all", conditions: [] })
        .then(() => this.close())
        .catch((error: unknown) => {
          clearButton.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法清除筛选条件。");
        });
    });
    const actionGroup = actions.createDiv({ cls: "ks-filter-modal__action-group" });
    const cancelButton = actionGroup.createEl("button", { cls: "ks-filter-modal__cancel", text: "取消" });
    cancelButton.addEventListener("click", () => this.close());
    const saveButton = actionGroup.createEl("button", { cls: "mod-cta ks-filter-modal__apply", text: "应用筛选" });
    saveButton.addEventListener("click", () => {
      saveButton.disabled = true;
      void this.onSave(this.filter)
        .then(() => this.close())
        .catch((error: unknown) => {
          saveButton.disabled = false;
          new Notice(error instanceof Error ? error.message : "无法保存筛选条件。");
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderConditions(): void {
    this.conditionsEl.empty();
    this.conditionCountEl.setText(String(this.filter.conditions.length));
    if (this.filter.conditions.length === 0) {
      const empty = this.conditionsEl.createDiv({ cls: "ks-filter-modal__empty" });
      const icon = empty.createSpan({ cls: "ks-filter-modal__empty-icon" });
      setIcon(icon, "list-plus");
      empty.createDiv({ cls: "ks-filter-modal__empty-title", text: "暂无筛选条件" });
      empty.createDiv({ cls: "ks-filter-modal__empty-hint", text: "留空时显示全部文档" });
      const firstCondition = empty.createEl("button", {
        cls: "ks-filter-modal__empty-add",
        attr: { type: "button" },
      });
      setIcon(firstCondition, "plus");
      firstCondition.createSpan({ text: "添加第一个条件" });
      firstCondition.addEventListener("click", () => this.addCondition());
      return;
    }
    this.filter.conditions.forEach((condition, index) => {
      this.renderCondition(condition, index);
    });
  }

  private renderCondition(condition: DocumentFilterCondition, index: number): void {
    const row = this.conditionsEl.createDiv({ cls: "ks-filter-modal__condition" });
    row.createSpan({ cls: "ks-filter-modal__index", text: String(index + 1) });
    const fieldSelect = row.createEl("select", { cls: "dropdown", attr: { "aria-label": "筛选字段" } });
    for (const field of this.fields) fieldSelect.createEl("option", { value: field.id, text: field.name });
    fieldSelect.value = condition.fieldId;
    fieldSelect.addEventListener("change", () => {
      condition.fieldId = fieldSelect.value;
      condition.value = undefined;
      this.renderConditions();
    });

    const operatorSelect = row.createEl("select", { cls: "dropdown", attr: { "aria-label": "筛选运算符" } });
    for (const [value, label] of Object.entries(OPERATOR_LABELS)) {
      operatorSelect.createEl("option", { value, text: label });
    }
    operatorSelect.value = condition.operator;
    operatorSelect.addEventListener("change", () => {
      condition.operator = operatorSelect.value as DocumentFilterOperator;
      this.renderConditions();
    });

    const field = this.fields.find((candidate) => candidate.id === condition.fieldId) ?? this.fields[0];
    const valueWrap = row.createDiv({ cls: "ks-filter-modal__value" });
    if (!["is-empty", "is-not-empty"].includes(condition.operator)) {
      this.renderValueEditor(valueWrap, field, condition);
    } else {
      valueWrap.createSpan({ cls: "ks-filter-modal__no-value", text: "无需输入值" });
    }
    const remove = row.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "移除筛选条件" } });
    setIcon(remove, "x");
    remove.addEventListener("click", () => {
      this.filter.conditions.splice(index, 1);
      this.renderConditions();
    });
  }

  private addCondition(): void {
    const field = this.fields[0];
    if (!field) return;
    this.filter.conditions.push({ fieldId: field.id, operator: "equals", value: undefined });
    this.renderConditions();
  }

  private renderValueEditor(
    container: HTMLElement,
    field: DocumentFieldDefinition,
    condition: DocumentFilterCondition,
  ): void {
    if (field.type === "checkbox") {
      const select = container.createEl("select", { cls: "dropdown" });
      select.createEl("option", { value: "true", text: "是" });
      select.createEl("option", { value: "false", text: "否" });
      select.value = condition.value === false ? "false" : "true";
      condition.value = select.value === "true";
      select.addEventListener("change", () => { condition.value = select.value === "true"; });
      return;
    }
    if (["single-select", "multi-select"].includes(field.type) && field.options.length > 0) {
      const select = container.createEl("select", { cls: "dropdown" });
      select.createEl("option", { value: "", text: "选择值…" });
      for (const option of field.options) select.createEl("option", { value: option, text: option });
      select.value = typeof condition.value === "string" ? condition.value : "";
      select.addEventListener("change", () => { condition.value = select.value || undefined; });
      return;
    }
    const input = container.createEl("input", {
      type: field.type === "number" ? "number" : field.type === "date" ? "date" : "text",
      placeholder: field.type === "tags" ? "标签值" : "输入比较值",
      attr: { "aria-label": "筛选比较值" },
    });
    input.value = condition.value === undefined || condition.value === null
      ? ""
      : Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value);
    input.addEventListener("input", () => {
      const raw = input.value.trim();
      let value: DocumentFieldValue | undefined = raw || undefined;
      if (field.type === "number" && raw) value = Number(raw);
      if (field.type === "tags" && raw) value = raw.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      condition.value = value;
    });
  }
}
