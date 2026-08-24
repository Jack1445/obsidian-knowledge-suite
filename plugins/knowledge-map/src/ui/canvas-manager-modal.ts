import { Modal, setIcon, TFile } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import type { FolderGraph, SavedNodePosition } from '../core/graph';
import { canvasDisplayName } from '../services/canvas-tree';
import type { KnowledgeCanvasType } from '../data/schema';

export class CanvasManagerModal extends Modal {
	constructor(
		private readonly plugin: KnowledgeMapPlugin,
		private readonly folderPath: string,
		private readonly graph: FolderGraph | null,
		private readonly positions: Record<string, SavedNodePosition> | null,
		private readonly parentCanvasPath?: string,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass('knowledge-map-canvas-manager-modal');
		this.titleEl.setText('管理画布');
		this.contentEl.createEl('p', {
			cls: 'knowledge-map-canvas-manager__intro',
			text: '创建独立的 2维或3维画布；新画布会保存为文件，并接入画布树。',
		});

		const actions = this.contentEl.createDiv({ cls: 'knowledge-map-canvas-manager__actions' });
		this.addAction(
			actions,
			'network',
			'2维画布',
			'以当前文件夹生成可继续展开子画布的二维知识结构。',
			'新建',
			true,
			() => void this.plugin.excalidraw.createKnowledgeCanvas(this.folderPath, this.parentCanvasPath),
		);
		this.addAction(
			actions,
			'globe-2',
			'3维画布',
			'新建一张空白地球画布，可从文件列表拖入文件或文件夹。',
			'新建',
			false,
			() => void this.plugin.createGlobeCanvas(this.folderPath, this.parentCanvasPath),
		);

		const drawings = this.plugin.store.getKnowledgeCanvasEntries()
			.flatMap(([filePath, state]): { file: TFile; canvasType: KnowledgeCanvasType }[] => {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				return file instanceof TFile ? [{ file, canvasType: state.canvasType }] : [];
			})
			.sort((left, right) => right.file.stat.mtime - left.file.stat.mtime);
		const section = this.contentEl.createDiv({ cls: 'knowledge-map-canvas-manager__section' });
		const heading = section.createDiv({ cls: 'knowledge-map-canvas-manager__section-heading' });
		heading.createEl('h3', { text: '已有画布' });
		heading.createSpan({ text: `${drawings.length} 张` });
		if (drawings.length === 0) {
			section.createDiv({
				cls: 'knowledge-map-canvas-manager__empty',
				text: '当前仓库中还没有画布。',
			});
			return;
		}
		const list = section.createDiv({ cls: 'knowledge-map-canvas-list' });
		for (const drawing of drawings) this.addDrawing(list, drawing.file, drawing.canvasType);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addAction(
		parent: HTMLElement,
		iconName: string,
		title: string,
		description: string,
		actionLabel: string,
		primary: boolean,
		onClick: () => void,
	): void {
		const button = parent.createEl('button', {
			cls: `knowledge-map-canvas-manager__action${primary ? ' is-primary' : ''}`,
		});
		const icon = button.createSpan({ cls: 'knowledge-map-canvas-manager__action-icon' });
		setIcon(icon, iconName);
		const body = button.createSpan({ cls: 'knowledge-map-canvas-manager__action-body' });
		body.createSpan({ cls: 'knowledge-map-canvas-manager__action-title', text: title });
		body.createSpan({ cls: 'knowledge-map-canvas-manager__action-desc', text: description });
		button.createSpan({ cls: 'knowledge-map-canvas-manager__action-label', text: actionLabel });
		button.addEventListener('click', () => {
			this.close();
			onClick();
		});
	}

	private addDrawing(parent: HTMLElement, file: TFile, canvasType: KnowledgeCanvasType): void {
		const button = parent.createEl('button', { cls: 'knowledge-map-canvas-list__item' });
		const icon = button.createSpan({ cls: 'knowledge-map-canvas-list__icon' });
		setIcon(icon, canvasType === '3d' ? 'globe-2' : 'network');
		const body = button.createSpan({ cls: 'knowledge-map-canvas-list__body' });
		body.createSpan({ cls: 'knowledge-map-canvas-list__name', text: canvasDisplayName(file.path) });
		body.createSpan({
			cls: 'knowledge-map-canvas-list__path',
			text: file.parent?.path === '/' ? '仓库根目录' : file.parent?.path ?? '仓库根目录',
		});
		button.createSpan({
			cls: 'knowledge-map-canvas-list__badge',
			text: canvasType === '3d' ? '3维画布' : '2维画布',
		});
		button.addEventListener('click', () => {
			this.close();
			void this.plugin.openManagedCanvasFile(file.path, false, this.folderPath);
		});
	}
}
