import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type KnowledgeMapController from '../KnowledgeMapController';

export class KnowledgeMapSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		host: Plugin,
		private readonly plugin: KnowledgeMapController,
	) {
		super(app, host);
	}

	getControlValue(key: string): unknown {
		if (key in this.plugin.store.settings) {
			return this.plugin.store.settings[key as keyof typeof this.plugin.store.settings];
		}
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case 'showExternalLinks':
			case 'showLabels':
				if (typeof value === 'boolean') await this.plugin.store.updateSettings({ [key]: value });
				break;
			case 'nodeScale':
			case 'linkScale':
				if (typeof value === 'number') await this.plugin.store.updateSettings({ [key]: value });
				break;
		}
		this.plugin.refreshViews();
	}

	/** Compatibility fallback for Obsidian versions before declarative settings. */
	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName('显示当前文件夹外的链接笔记')
			.setDesc('为已解析但不属于当前文件夹直接子项的链接目标显示淡化节点。')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.store.settings.showExternalLinks)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ showExternalLinks: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('显示节点标签')
			.setDesc('在图谱节点旁显示笔记和文件夹名称。')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.store.settings.showLabels)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ showLabels: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('节点大小')
			.setDesc('调整所有图谱节点的大小。')
			.addSlider((slider) => slider
				.setLimits(0.6, 1.8, 0.1)
				.setValue(this.plugin.store.settings.nodeScale)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ nodeScale: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('连线粗细')
			.setDesc('调整笔记链接线的粗细。')
			.addSlider((slider) => slider
				.setLimits(0.5, 2, 0.1)
				.setValue(this.plugin.store.settings.linkScale)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ linkScale: value });
					this.plugin.refreshViews();
				}));
	}
}
