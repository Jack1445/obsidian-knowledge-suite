import {
  Modal,
  TFile,
  TFolder,
  setIcon,
  type App,
} from "obsidian";

type MarkdownEligibility = (file: TFile) => boolean;

export class SemanticMarkdownPickerModal extends Modal {
  private currentFolder: TFolder;

  constructor(
    app: App,
    private readonly selectedPath: string | null,
    private readonly isEligible: MarkdownEligibility,
    private readonly onChoose: (path: string | null) => void,
  ) {
    super(app);
    this.currentFolder = this.resolveInitialFolder();
  }

  public onOpen(): void {
    this.modalEl.addClass("ks-semantic-markdown-picker");
    this.render();
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: "ks-semantic-markdown-picker__header" });
    const heading = header.createDiv();
    heading.createEl("h2", { text: "选择依托 Markdown" });
    heading.createEl("p", { text: "逐层打开文件夹，只显示普通 Markdown 文档" });
    this.renderBreadcrumbs();

    const list = this.contentEl.createDiv({ cls: "ks-semantic-markdown-picker__list" });
    const noneButton = this.createRow(list, "无依托 Markdown", "circle-slash-2", "保持为自由语义单位");
    noneButton.toggleClass("is-selected", this.selectedPath === null);
    noneButton.addEventListener("click", () => this.choose(null));

    const folders = this.currentFolder.children
      .filter((item): item is TFolder => item instanceof TFolder && this.folderHasEligibleMarkdown(item))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }));
    const files = this.currentFolder.children
      .filter((item): item is TFile => item instanceof TFile && this.isEligible(item))
      .sort((left, right) => left.basename.localeCompare(right.basename, undefined, {
        numeric: true,
        sensitivity: "base",
      }));

    for (const folder of folders) {
      const count = this.countEligibleMarkdown(folder);
      const row = this.createRow(list, folder.name, "folder", `${count} 份 Markdown`);
      const chevron = row.createSpan({ cls: "ks-semantic-markdown-picker__chevron" });
      setIcon(chevron, "chevron-right");
      row.addEventListener("click", () => {
        this.currentFolder = folder;
        this.render();
      });
    }
    for (const file of files) {
      const row = this.createRow(list, file.basename, "file-text", file.path);
      row.toggleClass("is-selected", this.selectedPath === file.path);
      const check = row.createSpan({ cls: "ks-semantic-markdown-picker__check" });
      if (this.selectedPath === file.path) setIcon(check, "check");
      row.addEventListener("click", () => this.choose(file.path));
    }

    if (folders.length === 0 && files.length === 0) {
      list.createDiv({
        cls: "ks-semantic-markdown-picker__empty",
        text: "这个文件夹中没有可选择的普通 Markdown 文档",
      });
    }
  }

  private renderBreadcrumbs(): void {
    const breadcrumbs = this.contentEl.createDiv({
      cls: "ks-semantic-markdown-picker__breadcrumbs",
      attr: { "aria-label": "当前文件夹路径" },
    });
    const root = this.app.vault.getRoot();
    const rootButton = breadcrumbs.createEl("button", {
      cls: "ks-semantic-markdown-picker__breadcrumb",
      attr: { "aria-label": "返回仓库根目录" },
    });
    setIcon(rootButton.createSpan(), "home");
    rootButton.createSpan({ text: "仓库" });
    rootButton.addEventListener("click", () => {
      this.currentFolder = root;
      this.render();
    });
    const segments = this.currentFolder.path.split("/").filter(Boolean);
    let path = "";
    for (const segment of segments) {
      setIcon(breadcrumbs.createSpan({ cls: "ks-semantic-markdown-picker__separator" }), "chevron-right");
      path = path ? `${path}/${segment}` : segment;
      const folder = this.app.vault.getAbstractFileByPath(path);
      if (!(folder instanceof TFolder)) continue;
      const button = breadcrumbs.createEl("button", {
        cls: "ks-semantic-markdown-picker__breadcrumb",
        text: segment,
      });
      button.addEventListener("click", () => {
        this.currentFolder = folder;
        this.render();
      });
    }
  }

  private createRow(
    parent: HTMLElement,
    title: string,
    iconName: string,
    detail: string,
  ): HTMLButtonElement {
    const row = parent.createEl("button", { cls: "ks-semantic-markdown-picker__row" });
    const icon = row.createSpan({ cls: "ks-semantic-markdown-picker__icon" });
    setIcon(icon, iconName);
    const text = row.createSpan({ cls: "ks-semantic-markdown-picker__text" });
    text.createSpan({ cls: "ks-semantic-markdown-picker__title", text: title });
    text.createSpan({ cls: "ks-semantic-markdown-picker__detail", text: detail });
    return row;
  }

  private choose(path: string | null): void {
    this.onChoose(path);
    this.close();
  }

  private resolveInitialFolder(): TFolder {
    if (!this.selectedPath) return this.app.vault.getRoot();
    const selected = this.app.vault.getAbstractFileByPath(this.selectedPath);
    return selected instanceof TFile && selected.parent
      ? selected.parent
      : this.app.vault.getRoot();
  }

  private folderHasEligibleMarkdown(folder: TFolder): boolean {
    return folder.children.some((item) =>
      item instanceof TFile
        ? this.isEligible(item)
        : item instanceof TFolder && this.folderHasEligibleMarkdown(item),
    );
  }

  private countEligibleMarkdown(folder: TFolder): number {
    return folder.children.reduce((count, item) =>
      count + (item instanceof TFile
        ? Number(this.isEligible(item))
        : item instanceof TFolder
          ? this.countEligibleMarkdown(item)
          : 0), 0);
  }
}
