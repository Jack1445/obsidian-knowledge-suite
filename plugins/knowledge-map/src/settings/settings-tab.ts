import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import type KnowledgeMapPlugin from '../main';

export class KnowledgeMapSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: KnowledgeMapPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Show linked notes outside the current folder',
				desc: 'Adds dimmed nodes for resolved links whose target is not a direct child of the open folder.',
				control: { type: 'toggle', key: 'showExternalLinks', defaultValue: false },
			},
			{
				name: 'Show node labels',
				desc: 'Show note and folder names next to graph nodes.',
				control: { type: 'toggle', key: 'showLabels', defaultValue: true },
			},
			{
				name: 'Node size',
				desc: 'Adjust the size of all graph nodes.',
				control: { type: 'slider', key: 'nodeScale', min: 0.6, max: 1.8, step: 0.1, defaultValue: 1 },
			},
			{
				name: 'Link thickness',
				desc: 'Adjust the thickness of note-link lines.',
				control: { type: 'slider', key: 'linkScale', min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
			},
		];
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
			.setName('Show linked notes outside the current folder')
			.setDesc('Adds dimmed nodes for resolved links whose target is not a direct child of the open folder.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.store.settings.showExternalLinks)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ showExternalLinks: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('Show node labels')
			.setDesc('Show note and folder names next to graph nodes.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.store.settings.showLabels)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ showLabels: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('Node size')
			.setDesc('Adjust the size of all graph nodes.')
			.addSlider((slider) => slider
				.setLimits(0.6, 1.8, 0.1)
				.setValue(this.plugin.store.settings.nodeScale)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ nodeScale: value });
					this.plugin.refreshViews();
				}));

		new Setting(this.containerEl)
			.setName('Link thickness')
			.setDesc('Adjust the thickness of note-link lines.')
			.addSlider((slider) => slider
				.setLimits(0.5, 2, 0.1)
				.setValue(this.plugin.store.settings.linkScale)
				.onChange(async (value) => {
					await this.plugin.store.updateSettings({ linkScale: value });
					this.plugin.refreshViews();
				}));
	}
}
