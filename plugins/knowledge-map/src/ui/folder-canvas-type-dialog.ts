import { Modal, setIcon, type App } from 'obsidian';
import type { KnowledgeCanvasType } from '../data/schema';

export interface FolderCanvasTypeOption {
	canvasType: KnowledgeCanvasType;
	existingPath?: string;
}

export class FolderCanvasTypeDialog extends Modal {
	constructor(
		app: App,
		private readonly folderName: string,
		private readonly options: readonly FolderCanvasTypeOption[],
		private readonly onSelect: (option: FolderCanvasTypeOption) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('knowledge-map-folder-canvas-dialog');
		this.titleEl.setText('打开文件夹画布');
		const hasExistingCanvas = this.options.some((option) => option.existingPath);
		this.contentEl.createEl('p', {
			cls: 'knowledge-map-folder-canvas-dialog__intro',
			text: hasExistingCanvas
				? `“${this.folderName}”的两种画布均已存在，请选择需要打开的画布。`
				: `“${this.folderName}”目前还没有对应的画布，请选择要新建的画布类型。`,
		});

		const choices = this.contentEl.createDiv({
			cls: 'knowledge-map-folder-canvas-dialog__choices',
		});
		for (const option of this.options) this.addChoice(choices, option);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addChoice(parent: HTMLElement, option: FolderCanvasTypeOption): void {
		const isGlobe = option.canvasType === '3d';
		const button = parent.createEl('button', {
			cls: `knowledge-map-folder-canvas-dialog__choice is-${option.canvasType}`,
			attr: { type: 'button' },
		});
		const icon = button.createSpan({
			cls: 'knowledge-map-folder-canvas-dialog__choice-icon',
		});
		setIcon(icon, isGlobe ? 'globe-2' : 'network');
		const body = button.createSpan({
			cls: 'knowledge-map-folder-canvas-dialog__choice-body',
		});
		body.createSpan({
			cls: 'knowledge-map-folder-canvas-dialog__choice-title',
			text: isGlobe ? '3维画布' : '2维画布',
		});
		body.createSpan({
			cls: 'knowledge-map-folder-canvas-dialog__choice-desc',
			text: isGlobe ? '在可旋转的地球上放置和组织内容' : '在自由平面中组织文件与画布关系',
		});
		button.createSpan({
			cls: 'knowledge-map-folder-canvas-dialog__choice-action',
			text: option.existingPath ? '打开' : '新建',
		});
		button.addEventListener('click', () => {
			this.close();
			this.onSelect(option);
		});
	}
}
