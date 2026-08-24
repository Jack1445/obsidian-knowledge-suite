import { ItemView, Menu, Notice, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import {
	buildCanvasTree,
	canvasDisplayName,
	canvasMovePath,
	canvasRenamePath,
	mergeCanvasReferences,
	type CanvasReferenceEntry,
	type CanvasTreeNode,
} from '../services/canvas-tree';
import { CanvasMoveModal, CanvasRenameModal } from '../ui/canvas-file-modals';

export const KNOWLEDGE_CANVAS_TREE_VIEW_TYPE = 'knowledge-canvas-tree-view';

export class CanvasTreeView extends ItemView {
	private readonly expandedPaths = new Set<string>();
	private readonly siblingPathsByParent = new Map<string, string[]>();
	private treeEl!: HTMLElement;
	private unsubscribeStore: (() => void) | null = null;
	private draggingCanvasPath: string | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: KnowledgeMapPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return KNOWLEDGE_CANVAS_TREE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return '画布树';
	}

	getIcon(): string {
		return 'folder-tree';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('knowledge-canvas-tree');
		const header = this.contentEl.createDiv({ cls: 'knowledge-canvas-tree__header' });
		header.createDiv({ cls: 'knowledge-canvas-tree__title', text: '画布树' });
		const refreshButton = header.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': '刷新画布树' },
		});
		setIcon(refreshButton, 'refresh-cw');
		refreshButton.addEventListener('click', () => this.refresh());
		this.treeEl = this.contentEl.createDiv({ cls: 'knowledge-canvas-tree__body' });
		this.unsubscribeStore = this.plugin.store.subscribeKnowledgeCanvases(() => this.refresh());
		this.refresh();
	}

	async onClose(): Promise<void> {
		this.unsubscribeStore?.();
		this.unsubscribeStore = null;
	}

	refresh(): void {
		if (!this.treeEl) return;
		this.treeEl.empty();
		this.siblingPathsByParent.clear();
		const entries = this.plugin.store.getKnowledgeCanvasEntries().filter(([filePath]) => {
			return this.app.vault.getAbstractFileByPath(filePath) instanceof TFile;
		});
		const roots = buildCanvasTree(entries, this.plugin.store.getCanvasOrders());
		if (roots.length === 0) {
			this.treeEl.createDiv({
				cls: 'knowledge-canvas-tree__empty',
				text: '还没有画布',
			});
			return;
		}
		this.rememberSiblingPaths(roots);
		const activePath = this.app.workspace.getActiveFile()?.path;
		roots.forEach((node, index) => {
			this.renderNode(node, 0, activePath, [], index === roots.length - 1);
		});
	}

	private renderNode(
		node: CanvasTreeNode,
		depth: number,
		activePath: string | undefined,
		ancestorContinuations: readonly boolean[],
		isLastSibling: boolean,
	): void {
		const item = this.treeEl.createDiv({ cls: 'knowledge-canvas-tree__item' });
		const row = item.createDiv({ cls: 'knowledge-canvas-tree__row' });
		this.registerRowDragging(row, node);
		if (node.filePath === activePath) row.addClass('is-active');
		const references = this.getCanvasReferences(node.filePath);
		this.renderTreeGuides(row, depth, ancestorContinuations, isLastSibling, false);

		const hasChildren = node.children.length > 0 || references.length > 0;
		const expanded = hasChildren && this.expandedPaths.has(node.filePath);
		const toggle = row.createEl('button', {
			cls: `knowledge-canvas-tree__toggle${hasChildren ? '' : ' is-placeholder'}`,
			attr: {
				'aria-label': expanded ? '收起子画布' : '展开子画布',
				'aria-expanded': String(expanded),
			},
		});
		if (hasChildren) {
			setIcon(toggle, expanded ? 'chevron-down' : 'chevron-right');
			toggle.addEventListener('click', (event) => {
				event.stopPropagation();
				this.toggleNode(node.filePath);
			});
		} else {
			toggle.disabled = true;
		}

		const canvasIcon = row.createSpan({ cls: 'knowledge-canvas-tree__icon' });
		setIcon(canvasIcon, node.canvasType === '3d' ? 'globe-2' : hasChildren ? 'network' : 'file');

		const label = row.createDiv({
			cls: 'knowledge-canvas-tree__label',
			text: canvasDisplayName(node.filePath),
			attr: {
				title: `${node.filePath}\n类型：${node.canvasType === '3d' ? '3维画布' : '2维画布'}\n对应文件夹：${node.folderPath}`,
				role: 'button',
				tabindex: '0',
			},
		});
		const activateNode = (openInNewLeaf: boolean): void => {
			if (hasChildren) this.expandedPaths.add(node.filePath);
			this.refresh();
			void this.openCanvas(node.filePath, openInNewLeaf);
		};
		label.addEventListener('click', (event) => {
			activateNode(event.ctrlKey || event.metaKey);
		});
		label.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			activateNode(event.ctrlKey || event.metaKey);
		});
		row.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.showCanvasMenu(node.filePath, event);
		});
		if (node.children.length > 0) {
			row.createSpan({
				cls: 'knowledge-canvas-tree__count',
				text: String(node.children.length),
				attr: { 'aria-label': `${node.children.length} 个子画布` },
			});
		}

		if (!expanded) return;
		node.children.forEach((child, index) => {
			this.renderNode(
				child,
				depth + 1,
				activePath,
				[...ancestorContinuations, !isLastSibling],
				index === node.children.length - 1 && references.length === 0,
			);
		});
		if (references.length > 0) {
			this.renderReferenceFolder(
				node.filePath,
				references,
				depth + 1,
				[...ancestorContinuations, !isLastSibling],
			);
		}
	}

	private rememberSiblingPaths(nodes: readonly CanvasTreeNode[], parentCanvasPath?: string): void {
		this.siblingPathsByParent.set(parentCanvasPath ?? '/', nodes.map((node) => node.filePath));
		for (const node of nodes) this.rememberSiblingPaths(node.children, node.filePath);
	}

	private registerRowDragging(row: HTMLElement, node: CanvasTreeNode): void {
		row.draggable = true;
		row.setAttr('aria-grabbed', 'false');
		row.addEventListener('dragstart', (event) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('button')) {
				event.preventDefault();
				return;
			}
			this.draggingCanvasPath = node.filePath;
			row.addClass('is-dragging');
			row.setAttr('aria-grabbed', 'true');
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', node.filePath);
			}
		});
		row.addEventListener('dragover', (event) => {
			const sourcePath = this.draggingCanvasPath;
			if (!sourcePath || sourcePath === node.filePath) return;
			const source = this.plugin.store.getKnowledgeCanvas(sourcePath);
			if (!source || source.parentCanvasPath !== node.parentCanvasPath) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			this.clearDropIndicators();
			const bounds = row.getBoundingClientRect();
			row.addClass(event.clientY < bounds.top + bounds.height / 2
				? 'is-drop-before'
				: 'is-drop-after');
		});
		row.addEventListener('dragleave', (event) => {
			const nextTarget = event.relatedTarget as Node | null;
			if (!nextTarget || !row.contains(nextTarget)) {
				row.removeClass('is-drop-before', 'is-drop-after');
			}
		});
		row.addEventListener('drop', (event) => {
			const sourcePath = this.draggingCanvasPath;
			if (!sourcePath || sourcePath === node.filePath) return;
			const source = this.plugin.store.getKnowledgeCanvas(sourcePath);
			if (!source || source.parentCanvasPath !== node.parentCanvasPath) return;
			event.preventDefault();
			const parentKey = node.parentCanvasPath ?? '/';
			const siblings = this.siblingPathsByParent.get(parentKey) ?? [];
			const reordered = siblings.filter((filePath) => filePath !== sourcePath);
			const targetIndex = reordered.indexOf(node.filePath);
			if (targetIndex < 0) return;
			const insertAfter = row.hasClass('is-drop-after');
			reordered.splice(targetIndex + (insertAfter ? 1 : 0), 0, sourcePath);
			this.draggingCanvasPath = null;
			this.clearDropIndicators();
			this.plugin.store.setCanvasOrder(node.parentCanvasPath, reordered);
		});
		row.addEventListener('dragend', () => {
			this.draggingCanvasPath = null;
			row.removeClass('is-dragging');
			row.setAttr('aria-grabbed', 'false');
			this.clearDropIndicators();
		});
	}

	private clearDropIndicators(): void {
		this.treeEl.querySelectorAll<HTMLElement>('.is-drop-before, .is-drop-after')
			.forEach((element) => element.removeClass('is-drop-before', 'is-drop-after'));
	}

	private getCanvasReferences(filePath: string): CanvasReferenceEntry[] {
		const outgoing = this.plugin.store.getOutgoingCanvasReferences(filePath)
			.filter((targetPath) => Boolean(this.plugin.store.getKnowledgeCanvas(targetPath)));
		const incoming = this.plugin.store.getIncomingCanvasReferences(filePath)
			.filter((sourcePath) => Boolean(this.plugin.store.getKnowledgeCanvas(sourcePath)));
		return mergeCanvasReferences(outgoing, incoming);
	}

	private renderReferenceFolder(
		sourcePath: string,
		references: CanvasReferenceEntry[],
		depth: number,
		ancestorContinuations: readonly boolean[],
	): void {
		const key = `references:${sourcePath}`;
		const expanded = this.expandedPaths.has(key);
		const row = this.treeEl.createDiv({ cls: 'knowledge-canvas-tree__row is-reference-folder' });
		this.renderTreeGuides(row, depth, ancestorContinuations, true, false);
		const toggle = row.createEl('button', {
			cls: 'knowledge-canvas-tree__toggle',
			attr: {
				'aria-label': expanded ? '收起引用' : '展开引用',
				'aria-expanded': String(expanded),
			},
		});
		setIcon(toggle, expanded ? 'chevron-down' : 'chevron-right');
		const icon = row.createSpan({ cls: 'knowledge-canvas-tree__icon' });
		setIcon(icon, expanded ? 'folder-open' : 'folder');
		const label = row.createDiv({
			cls: 'knowledge-canvas-tree__label',
			text: '引用',
			attr: { role: 'button', tabindex: '0' },
		});
		row.createSpan({
			cls: 'knowledge-canvas-tree__count',
			text: String(references.length),
			attr: { 'aria-label': `${references.length} 个引用关系` },
		});
		const toggleFolder = (): void => {
			if (this.expandedPaths.has(key)) this.expandedPaths.delete(key);
			else this.expandedPaths.add(key);
			this.refresh();
		};
		toggle.addEventListener('click', (event) => {
			event.stopPropagation();
			toggleFolder();
		});
		label.addEventListener('click', toggleFolder);
		label.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			toggleFolder();
		});
		if (!expanded) return;
		const childAncestors = [...ancestorContinuations, false];
		references.forEach((reference, index) => {
			this.renderReferenceEntry(
				reference,
				depth + 1,
				childAncestors,
				index === references.length - 1,
			);
		});
	}

	private renderReferenceEntry(
		reference: CanvasReferenceEntry,
		depth: number,
		ancestorContinuations: readonly boolean[],
		isLastSibling: boolean,
	): void {
		const row = this.treeEl.createDiv({ cls: 'knowledge-canvas-tree__row is-reference-entry' });
		this.renderTreeGuides(row, depth, ancestorContinuations, isLastSibling, true);
		row.createSpan({ cls: 'knowledge-canvas-tree__toggle is-placeholder' });
		row.createSpan({
			cls: `knowledge-canvas-tree__reference-direction is-${reference.direction}`,
			text: reference.direction === 'both' ? '↔' : reference.direction === 'outgoing' ? '↗' : '↙',
		});
		const prefix = reference.direction === 'both'
			? '相互引用'
			: reference.direction === 'outgoing' ? '引用了' : '被引用';
		const label = row.createDiv({
			cls: 'knowledge-canvas-tree__label',
			text: `${prefix}：${canvasDisplayName(reference.filePath)}`,
			attr: {
				title: reference.filePath,
				role: 'button',
				tabindex: '0',
			},
		});
		const open = (): void => {
			void this.openCanvas(reference.filePath, false);
		};
		label.addEventListener('click', open);
		label.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			open();
		});
	}

	private renderTreeGuides(
		row: HTMLElement,
		depth: number,
		ancestorContinuations: readonly boolean[],
		isLastSibling: boolean,
		reference: boolean,
	): void {
		const guides = row.createDiv({ cls: 'knowledge-canvas-tree__guides' });
		for (let level = 0; level < depth; level += 1) {
			const guide = guides.createSpan({ cls: 'knowledge-canvas-tree__guide' });
			if (reference && level === depth - 1) guide.addClass('is-reference');
			if (level === depth - 1) {
				guide.addClass('is-branch');
				guide.addClass(isLastSibling ? 'is-last' : 'has-next');
			} else if (ancestorContinuations[level]) {
				guide.addClass('is-continuation');
			}
		}
	}

	private toggleNode(filePath: string): void {
		if (this.expandedPaths.has(filePath)) this.expandedPaths.delete(filePath);
		else this.expandedPaths.add(filePath);
		this.refresh();
	}

	private async openCanvas(filePath: string, openInNewLeaf: boolean): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice('该画布已不存在。');
			this.refresh();
			return;
		}
		await this.plugin.openManagedCanvasFile(filePath, openInNewLeaf);
	}

	private showCanvasMenu(filePath: string, event: MouseEvent): void {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice('该画布已不存在。');
			this.refresh();
			return;
		}
		const menu = Menu.forEvent(event);
		menu.addItem((item) => item
			.setTitle('打开')
			.setIcon('file')
			.setSection('open')
			.onClick(() => void this.openCanvas(file.path, false)));
		menu.addItem((item) => item
			.setTitle('在新标签页中打开')
			.setIcon('file-plus')
			.setSection('open')
			.onClick(() => void this.openCanvas(file.path, true)));
		menu.addItem((item) => item
			.setTitle('重命名')
			.setIcon('pencil')
			.setSection('action')
			.onClick(() => this.renameCanvas(file)));
		menu.addItem((item) => item
			.setTitle('移动到…')
			.setIcon('folder-input')
			.setSection('action')
			.onClick(() => this.moveCanvas(file)));
		menu.addItem((item) => item
			.setTitle('复制路径')
			.setIcon('copy')
			.setSection('info')
			.onClick(() => void this.copyPath(file.path)));
		menu.addItem((item) => item
			.setTitle('在文件列表中定位')
			.setIcon('folder-search')
			.setSection('info')
			.onClick(() => void this.revealInFileNavigation(file)));
		menu.addItem((item) => item
			.setTitle('删除')
			.setIcon('trash-2')
			.setWarning(true)
			.setSection('danger')
			.onClick(() => void this.deleteCanvas(file)));
		this.app.workspace.trigger('file-menu', menu, file, 'knowledge-canvas-tree', this.leaf);
		menu.showAtMouseEvent(event);
	}

	private renameCanvas(file: TFile): void {
		new CanvasRenameModal(this.app, canvasDisplayName(file.path), (name) => {
			const newPath = canvasRenamePath(file.path, name);
			if (!newPath) {
				new Notice('请输入有效的画布名称，不能包含 \\ / : * ? " < > | 字符。');
				return;
			}
			if (newPath === file.path) return;
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				new Notice(`目标位置已存在文件：${newPath}`);
				return;
			}
			void this.app.fileManager.renameFile(file, newPath).catch(() => {
				new Notice('无法重命名该画布。');
			});
		}).open();
	}

	private moveCanvas(file: TFile): void {
		new CanvasMoveModal(this.app, (folder) => {
			const newPath = canvasMovePath(file.path, folder.path);
			if (newPath === file.path) return;
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				new Notice(`目标位置已存在文件：${newPath}`);
				return;
			}
			void this.app.fileManager.renameFile(file, newPath).catch(() => {
				new Notice('无法移动该画布。');
			});
		}).open();
	}

	private async copyPath(filePath: string): Promise<void> {
		const clipboard = this.contentEl.ownerDocument.defaultView?.navigator.clipboard;
		if (!clipboard) {
			new Notice('无法访问剪贴板。');
			return;
		}
		try {
			await clipboard.writeText(filePath);
			new Notice('画布路径已复制。');
		} catch {
			new Notice('无法复制画布路径。');
		}
	}

	private async revealInFileNavigation(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		const view = leaf?.view as unknown as {
			revealInFolder?: (target: TFile) => void | Promise<void>;
		} | undefined;
		if (!leaf || !view?.revealInFolder) {
			new Notice('文件列表当前不可用。');
			return;
		}
		await this.app.workspace.revealLeaf(leaf);
		await view.revealInFolder(file);
	}

	private async deleteCanvas(file: TFile): Promise<void> {
		if (!await this.app.fileManager.promptForDeletion(file)) return;
		try {
			await this.app.fileManager.trashFile(file);
		} catch {
			new Notice('无法删除该画布。');
		}
	}
}
