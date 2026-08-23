import { Modal, Setting, TFile } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import type { FolderGraph, SavedNodePosition } from '../core/graph';

export class CanvasManagerModal extends Modal {
	constructor(
		private readonly plugin: KnowledgeMapPlugin,
		private readonly folderPath: string,
		private readonly graph: FolderGraph | null,
		private readonly positions: Record<string, SavedNodePosition> | null,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.titleEl.setText('Knowledge canvases');
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Create a live knowledge canvas with the complete Excalidraw toolset, a plain drawing, or open the 3d globe.',
		});

		new Setting(this.contentEl)
			.setName('Knowledge canvas')
			.setDesc('Start with this folder map inside Excalidraw. Drill into folders and drag more vault files or folders onto the drawing.')
			.addButton((button) => button.setButtonText('Create').setCta().onClick(() => {
				this.close();
				void this.plugin.excalidraw.createKnowledgeCanvas(this.folderPath);
			}));

		new Setting(this.contentEl)
			.setName('Plain Excalidraw canvas')
			.setDesc('Create an empty Excalidraw drawing without automatic knowledge map nodes.')
			.addButton((button) => button.setButtonText('Create').onClick(() => {
				this.close();
				void this.plugin.excalidraw.createBlank(this.folderPath);
			}));

		new Setting(this.contentEl)
			.setName('Globe canvas')
			.setDesc("Place this folder's nodes on an interactive globe. Drag a label to save its geographic position.")
			.addButton((button) => button.setButtonText('Open').onClick(() => {
				this.close();
				void this.plugin.activateGlobe(this.folderPath);
			}));

		this.contentEl.createEl('h3', { text: 'Existing Excalidraw canvases' });
		const drawings = this.app.vault.getFiles()
			.filter((file) => this.plugin.excalidraw.isDrawing(file))
			.sort((left, right) => right.stat.mtime - left.stat.mtime);
		if (drawings.length === 0) {
			this.contentEl.createEl('p', {
				cls: 'setting-item-description',
				text: 'No Excalidraw canvases were found in this vault.',
			});
			return;
		}
		const list = this.contentEl.createDiv({ cls: 'knowledge-map-canvas-list' });
		for (const file of drawings) this.addDrawing(list, file);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addDrawing(parent: HTMLElement, file: TFile): void {
		const button = parent.createEl('button', { cls: 'knowledge-map-canvas-list__item' });
		const prefix = this.plugin.excalidraw.isKnowledgeCanvas(file) ? 'Knowledge · ' : '';
		button.createSpan({ cls: 'knowledge-map-canvas-list__name', text: `${prefix}${file.basename}` });
		button.createSpan({ cls: 'knowledge-map-canvas-list__path', text: file.parent?.path ?? '/' });
		button.addEventListener('click', () => {
			this.close();
			void this.app.workspace.openLinkText(file.path, this.folderPath, false);
		});
	}
}
