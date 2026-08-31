import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import { VaultPathSuggest } from "../shared/Suggesters/VaultPathSuggest";
import type ExcalidrawPlugin from "./main";

/**
 * Provides a deliberately small global settings surface for Knowledge Suite.
 * Feature-specific controls remain beside the feature they affect.
 */
export class KnowledgeSuiteSettingTab extends PluginSettingTab {
  private readonly knowledgeSuitePlugin: ExcalidrawPlugin;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.knowledgeSuitePlugin = plugin;
  }

  /**
   * Returns no searchable controls because this page intentionally contains
   * informational guidance only.
   */
  getSettingDefinitions(): [] {
    return [];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("knowledge-suite-settings");

    const header = containerEl.createDiv({
      cls: "knowledge-suite-settings__header",
    });
    const icon = header.createDiv({
      cls: "knowledge-suite-settings__icon",
    });
    setIcon(icon, "boxes");

    const heading = header.createDiv({
      cls: "knowledge-suite-settings__heading",
    });
    heading.createDiv({
      text: this.knowledgeSuitePlugin.manifest.name,
      cls: "knowledge-suite-settings__title",
    });
    heading.createEl("p", {
      text: `版本 ${this.knowledgeSuitePlugin.manifest.version}`,
      cls: "knowledge-suite-settings__version",
    });

    const emptyState = containerEl.createDiv({
      cls: "knowledge-suite-settings__card knowledge-suite-settings__empty-state",
    });
    const emptyStateIcon = emptyState.createDiv({
      cls: "knowledge-suite-settings__empty-icon",
    });
    setIcon(emptyStateIcon, "sliders-horizontal");
    const emptyStateCopy = emptyState.createDiv();
    emptyStateCopy.createDiv({
      text: "只保留真正的全局默认值",
      cls: "knowledge-suite-settings__section-title",
    });
    emptyStateCopy.createEl("p", {
      text: "新建画布的默认路径与名称在这里设置；其他功能仍在对应页面或画布附近调整。",
    });

    this.addCanvasDefaults(containerEl);

    const locations = containerEl.createDiv({
      cls: "knowledge-suite-settings__card",
    });
    locations.createDiv({
      text: "在哪里调整",
      cls: "knowledge-suite-settings__section-title",
    });
    this.addLocation(
      locations,
      "layout-dashboard",
      "知识管理",
      "管理 Markdown 标签与属性、画布语义单位及其关联。",
    );
    this.addLocation(
      locations,
      "scan-search",
      "语义筛选画布",
      "设置筛选条件、整理布局与临时查看语义单位。",
    );
    this.addLocation(
      locations,
      "move",
      "二维画布与知识地图",
      "缩放、布局和显示参数保留在各自的画布工具栏中。",
    );

    const safety = containerEl.createDiv({
      cls: "knowledge-suite-settings__card knowledge-suite-settings__safety",
    });
    const safetyIcon = safety.createDiv({
      cls: "knowledge-suite-settings__safety-icon",
    });
    setIcon(safetyIcon, "shield-check");
    const safetyCopy = safety.createDiv();
    safetyCopy.createDiv({
      text: "数据保护始终启用",
      cls: "knowledge-suite-settings__section-title",
    });
    safetyCopy.createEl("p", {
      text: "备份、格式校验与旧数据兼容属于基础保护，不提供关闭开关。",
    });
  }

  private addCanvasDefaults(container: HTMLElement): void {
    const details = container.createEl("details", {
      cls: "knowledge-suite-settings__card knowledge-suite-settings__defaults",
    });
    const summary = details.createEl("summary", {
      cls: "knowledge-suite-settings__defaults-summary",
    });
    const summaryIcon = summary.createDiv({
      cls: "knowledge-suite-settings__location-icon",
    });
    setIcon(summaryIcon, "folder-cog");
    const summaryCopy = summary.createDiv({
      cls: "knowledge-suite-settings__defaults-copy",
    });
    summaryCopy.createDiv({
      text: "默认路径/命名设置",
      cls: "knowledge-suite-settings__section-title",
    });
    summaryCopy.createEl("p", {
      text: "为以后新建的2维与3维画布设置默认名称和保存位置。",
    });
    const chevron = summary.createDiv({
      cls: "knowledge-suite-settings__defaults-chevron",
    });
    setIcon(chevron, "chevron-down");

    const body = details.createDiv({
      cls: "knowledge-suite-settings__defaults-body",
    });
    body.createDiv({
      cls: "knowledge-suite-settings__defaults-note",
      text: "所有项目均可留空。留空时沿用当前规则；修改只影响之后新建的管理画布，不会移动或重命名已有画布。",
    });

    if (!this.knowledgeSuitePlugin.knowledgeMap?.store) {
      body.createDiv({
        cls: "knowledge-suite-settings__defaults-note is-warning",
        text: "画布管理尚未完成初始化，请重新加载插件后再设置。",
      });
      return;
    }

    this.addCanvasDefaultGroup(body, "2维画布", "2d");
    this.addCanvasDefaultGroup(body, "3维画布", "3d");
  }

  private addCanvasDefaultGroup(
    container: HTMLElement,
    title: string,
    canvasType: "2d" | "3d",
  ): void {
    const store = this.knowledgeSuitePlugin.knowledgeMap?.store;
    if (!store) return;
    const settings = store.settings;
    const group = container.createDiv({
      cls: "knowledge-suite-settings__defaults-group",
    });
    group.createDiv({
      text: title,
      cls: "knowledge-suite-settings__defaults-group-title",
    });

    const nameKey =
      canvasType === "2d" ? "default2dCanvasName" : "default3dCanvasName";
    const folderKey =
      canvasType === "2d" ? "default2dCanvasFolder" : "default3dCanvasFolder";
    new Setting(group)
      .setName("默认名称")
      .setDesc("留空时继续使用当前的文件夹名称、画布类型和创建时间。")
      .addText((text) => {
        text
          .setPlaceholder(canvasType === "2d" ? "例如：项目总览" : "例如：知识星球")
          .setValue(settings[nameKey])
          .onChange((value) => store.setSettings({ [nameKey]: value }));
      });

    new Setting(group)
      .setName("默认保存路径")
      .setDesc("输入或选择仓库内文件夹；输入 / 表示仓库根目录。")
      .addText((text) => {
        text
          .setPlaceholder("留空以沿用当前保存位置")
          .setValue(settings[folderKey])
          .onChange((value) => store.setSettings({ [folderKey]: value }));
        new VaultPathSuggest(this.app, text.inputEl, "folder");
      });
  }

  private addLocation(
    container: HTMLElement,
    iconName: string,
    title: string,
    description: string,
  ): void {
    const row = container.createDiv({
      cls: "knowledge-suite-settings__location",
    });
    const icon = row.createDiv({
      cls: "knowledge-suite-settings__location-icon",
    });
    setIcon(icon, iconName);
    const copy = row.createDiv();
    copy.createDiv({
      text: title,
      cls: "knowledge-suite-settings__location-title",
    });
    copy.createEl("p", { text: description });
  }
}
