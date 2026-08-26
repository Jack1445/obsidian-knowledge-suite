import {
	Menu,
	Notice,
	TAbstractFile,
	TFile,
	TFolder,
	TextFileView,
	type WorkspaceLeaf,
} from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import { GlobeRenderer } from '../globe/globe-renderer';
import {
	addGlobeCanvasNodes,
	createEmptyGlobeCanvasDocument,
	parseGlobeCanvasDocument,
	removeGlobeCanvasNodes,
	serializeGlobeCanvasDocument,
	setGlobeCanvasNodeAppearance,
	setGlobeCanvasNodePosition,
	setGlobeCanvasNodeSize,
	type GlobeCanvasNode,
} from '../globe/globe-canvas-document';
import {
	mergeKnowledgeCanvasNodeAppearance,
	type KnowledgeCanvasNodeAppearance,
	type KnowledgeCanvasNodePalette,
	type KnowledgeCanvasNodeShape,
} from '../integrations/knowledge-canvas-model';
import { CustomNodeColorDialog } from '../ui/custom-node-color-dialog';
import { ManagedNodeIconDialog } from '../ui/managed-node-icon-dialog';
import { GlobeNodeRemoveDialog } from '../ui/globe-node-remove-dialog';

export const KNOWLEDGE_MAP_GLOBE_VIEW_TYPE = 'knowledge-map-globe-view';

const GLOBE_NODE_PALETTES: readonly { id: KnowledgeCanvasNodePalette; label: string }[] = [
	{ id: 'default', label: '默认' },
	{ id: 'blue', label: '蓝色' },
	{ id: 'purple', label: '紫色' },
	{ id: 'green', label: '绿色' },
	{ id: 'orange', label: '橙色' },
	{ id: 'red', label: '红色' },
];

const GLOBE_NODE_EXTENDED_PALETTES: readonly { id: KnowledgeCanvasNodePalette; label: string }[] = [
	{ id: 'gray', label: '灰色' }, { id: 'black', label: '黑色' },
	{ id: 'cyan', label: '青色' }, { id: 'teal', label: '蓝绿色' },
	{ id: 'indigo', label: '靛蓝色' }, { id: 'violet', label: '罗兰紫' },
	{ id: 'magenta', label: '品红色' }, { id: 'pink', label: '粉色' },
	{ id: 'rose', label: '玫红色' }, { id: 'lime', label: '青柠色' },
	{ id: 'yellow', label: '黄色' }, { id: 'amber', label: '琥珀色' },
	{ id: 'brown', label: '棕色' },
];

const GLOBE_NODE_SHAPES: readonly { id: KnowledgeCanvasNodeShape; label: string }[] = [
	{ id: 'ellipse', label: '圆形' },
	{ id: 'rounded', label: '圆角方形' },
	{ id: 'rectangle', label: '方形' },
	{ id: 'diamond', label: '菱形' },
];

export class GlobeView extends TextFileView {
	private document = createEmptyGlobeCanvasDocument();
	private renderer: GlobeRenderer | null = null;
	private globeEl!: HTMLElement;
	private selectedNodeIds = new Set<string>();

	constructor(leaf: WorkspaceLeaf, private readonly plugin: KnowledgeMapPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return KNOWLEDGE_MAP_GLOBE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? '3维画布';
	}

	getIcon(): string {
		return 'globe-2';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('knowledge-map-globe');
		this.globeEl = this.contentEl.createDiv({ cls: 'knowledge-map-globe__stage' });
		this.registerDomEvent(this.globeEl, 'dragenter', (event) => this.handleDragOver(event));
		this.registerDomEvent(this.globeEl, 'dragover', (event) => this.handleDragOver(event));
		this.registerDomEvent(this.globeEl, 'dragleave', (event) => {
			if (!this.globeEl.contains(event.relatedTarget as Node | null)) {
				this.globeEl.removeClass('is-dragging-over');
			}
		});
		this.registerDomEvent(this.globeEl, 'drop', (event) => this.handleDrop(event));
		this.registerDomEvent(document, 'keydown', (event) => this.handleKeyDown(event));
		this.registerDomEvent(document, 'keyup', (event) => this.handleKeyUp(event));
		this.registerDomEvent(window, 'blur', () => this.renderer?.setSpacePressed(false));
		this.renderGlobe();
	}

	async onClose(): Promise<void> {
		this.renderer?.setSpacePressed(false);
		this.renderer?.destroy();
		await super.onClose();
	}

	getViewData(): string {
		return serializeGlobeCanvasDocument(this.document);
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) this.clear();
		this.data = data;
		this.document = parseGlobeCanvasDocument(data);
		this.renderGlobe();
	}

	clear(): void {
		this.renderer?.destroy();
		this.renderer = null;
		this.document = createEmptyGlobeCanvasDocument();
		this.data = serializeGlobeCanvasDocument(this.document);
		this.globeEl?.empty();
	}

	focusPath(path: string): boolean {
		const node = this.document.nodes.find((candidate) => candidate.path === path);
		return node ? this.renderer?.focusNode(node.id) ?? false : false;
	}

	private renderGlobe(): void {
		if (!this.globeEl) return;
		this.renderer?.destroy();
		this.globeEl.empty();
		this.selectedNodeIds.clear();
		const validNodes = this.document.nodes.filter((node) => {
			return this.app.vault.getAbstractFileByPath(node.path) instanceof TAbstractFile;
		});
		this.renderer = new GlobeRenderer({
			container: this.globeEl,
			nodes: validNodes.map((node) => ({
				...node,
				appearance: mergeKnowledgeCanvasNodeAppearance(node.appearance),
				canvasType: this.plugin.store.getKnowledgeCanvas(node.path)?.canvasType,
			})),
			positions: Object.fromEntries(this.document.nodes.map((node) => [node.id, node.position])),
			onNodeActivate: (node, event) => {
				const canvasState = this.plugin.store.getKnowledgeCanvas(node.path);
				if (canvasState) {
					const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
					void this.plugin.openManagedCanvasFile(node.path, newLeaf, this.file?.path ?? '');
					return;
				}
				if (node.kind === 'folder' && this.file) {
					void this.plugin.openOrChooseChildCanvas(this.file.path, node.path);
					return;
				}
				const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
				void this.app.workspace.openLinkText(node.path, this.file?.path ?? '', newLeaf);
			},
			onNodeContextMenu: (node, event) => {
				const documentNode = this.document.nodes.find((candidate) => candidate.id === node.id);
				if (documentNode) this.showNodeMenu(documentNode, event);
			},
			onPositionChange: (nodeId, position) => {
				this.document = setGlobeCanvasNodePosition(this.document, nodeId, position);
				this.queueDocumentSave();
			},
			onSizeChange: (nodeId, size) => {
				this.document = setGlobeCanvasNodeSize(this.document, nodeId, size);
				this.queueDocumentSave();
			},
			onSelectionChange: (nodeIds) => {
				this.selectedNodeIds = new Set(nodeIds);
			},
		});
		const empty = this.globeEl.createDiv({
			cls: 'knowledge-map-globe__empty',
			text: '将仓库中的文件或文件夹拖到地球表面',
		});
		empty.toggleClass('is-hidden', validNodes.length > 0);
		this.globeEl.createDiv({
			cls: 'knowledge-map-globe__interaction-hint',
			text: '空格+左键旋转地图',
		});
		void this.renderer.mount().catch(() => {
			new Notice('3维画布无法启动，请检查 webgl 支持和开发者控制台。');
		});
	}

	private handleDragOver(event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		this.globeEl.addClass('is-dragging-over');
	}

	private handleDrop(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.globeEl.removeClass('is-dragging-over');
		const position = this.renderer?.positionAt(event.clientX, event.clientY);
		if (!position) {
			new Notice('请把文件拖放到地球表面。');
			return;
		}
		const items = this.collectDroppedItems(event.dataTransfer);
		if (items.length === 0) {
			new Notice('没有识别到仓库中的文件或文件夹。');
			return;
		}
		const acceptedItems = items.filter((item) => item.path !== this.file?.path);
		if (acceptedItems.length !== items.length) new Notice('不能把画布拖入它自己。');
		if (acceptedItems.length === 0) return;
		const nodes = acceptedItems.map((item, index): GlobeCanvasNode => {
			const isFolder = item instanceof TFolder;
			const column = index % 4;
			const row = Math.floor(index / 4);
			return {
				id: `${isFolder ? 'folder' : 'note'}:${item.path}`,
				kind: isFolder ? 'folder' : 'note',
				path: item.path,
				label: item instanceof TFile ? item.basename : item.name,
				position: {
					lat: Math.max(-86, Math.min(86, position.lat + row * 5)),
					lng: position.lng + column * 7,
				},
			};
		});
		this.document = addGlobeCanvasNodes(this.document, nodes);
		this.queueDocumentSave();
		if (this.file) {
			for (const item of acceptedItems) {
				if (
					this.plugin.store.getKnowledgeCanvas(item.path)
					&& !this.plugin.store.addCanvasReference(this.file.path, item.path)
				) new Notice('无法建立画布引用关系。');
			}
		}
		this.renderGlobe();
		new Notice(`已添加 ${nodes.length} 个项目到3维画布。`);
	}

	private showNodeMenu(node: GlobeCanvasNode, event: MouseEvent): void {
		if (!this.file) return;
		const target = this.app.vault.getAbstractFileByPath(node.path);
		if (!(target instanceof TFile) && !(target instanceof TFolder)) return;
		const canvasState = target instanceof TFile
			? this.plugin.store.getKnowledgeCanvas(target.path)
			: undefined;
		const menu = Menu.forEvent(event).setUseNativeMenu(false);
		const kind = canvasState ? 'canvas' : target instanceof TFolder ? 'folder' : 'file';
		menu.addItem((item) => item
			.setTitle(canvasState
				? `${canvasState.canvasType === '3d' ? '3维画布' : '2维画布'} · ${target.name.replace(/\.(?:canvas3d|excalidraw\.md)$/i, '')}`
				: target instanceof TFolder ? `文件夹 · ${target.name}` : `文件 · ${target.basename}`)
			.setIcon(canvasState ? canvasState.canvasType === '3d' ? 'globe-2' : 'network' : target instanceof TFolder ? 'folder-tree' : 'file-text')
			.setIsLabel(true)
			.setSection(`knowledge-map-header-${kind}`));

		if (canvasState && target instanceof TFile) {
			const isChild = this.plugin.store.getParentKnowledgeCanvasPath(target.path) === this.file.path;
			menu.addItem((item) => item
				.setTitle('打开画布')
				.setIcon('panel-top-open')
				.setSection('knowledge-map-open')
				.onClick(() => void this.plugin.openManagedCanvasFile(target.path, false, this.file?.path ?? '')));
			menu.addItem((item) => item
				.setTitle('在新标签页中打开')
				.setIcon('external-link')
				.setSection('knowledge-map-open')
				.onClick(() => void this.plugin.openManagedCanvasFile(target.path, true, this.file?.path ?? '')));
			menu.addItem((item) => item
				.setTitle(isChild ? '取消设为子画布' : '设为子画布')
				.setIcon(isChild ? 'unlink' : 'git-branch-plus')
				.setSection('knowledge-map-relationship')
				.onClick(() => this.setCanvasChildRelationship(target.path, isChild)));
		} else if (target instanceof TFolder) {
			const childPaths = (['2d', '3d'] as const)
				.map((canvasType) => this.plugin.store.findChildKnowledgeCanvas(
					this.file!.path,
					target.path,
					canvasType,
				))
				.filter((path): path is string => Boolean(path));
			const isChild = childPaths.length > 0;
			menu.addItem((item) => item
				.setTitle('打开文件夹画布')
				.setIcon('folder-open')
				.setSection('knowledge-map-open')
				.onClick(() => void this.plugin.openOrChooseChildCanvas(this.file!.path, target.path)));
			menu.addItem((item) => item
				.setTitle(isChild ? '取消设为子画布' : '设为子画布')
				.setIcon(isChild ? 'unlink' : 'git-branch-plus')
				.setSection('knowledge-map-relationship')
				.onClick(() => void this.setFolderChildRelationship(target.path, childPaths)));
		} else if (target instanceof TFile) {
			menu.addItem((item) => item
				.setTitle('打开文件')
				.setIcon('panel-top-open')
				.setSection('knowledge-map-open')
				.onClick(() => void this.app.workspace.openLinkText(target.path, this.file?.path ?? '', false)));
			menu.addItem((item) => item
				.setTitle('在新标签页中打开')
				.setIcon('external-link')
				.setSection('knowledge-map-open')
				.onClick(() => void this.app.workspace.openLinkText(target.path, this.file?.path ?? '', true)));
			menu.addItem((item) => item
				.setTitle('在文件列表中定位')
				.setIcon('folder-search')
				.setSection('knowledge-map-info')
				.onClick(() => void this.revealInFileNavigation(target)));
			menu.addItem((item) => item
				.setTitle('复制路径')
				.setIcon('copy')
				.setSection('knowledge-map-info')
				.onClick(() => void this.copyVaultPath(target.path)));
		}
		this.addNodeAppearanceControls(menu, node, event);
		if (target instanceof TFile && !canvasState) {
			this.app.workspace.trigger('file-menu', menu, target, 'knowledge-globe');
		}
		menu.addSeparator();
		menu.addItem((item) => item
			.setTitle('从本画布移除')
			.setIcon('trash-2')
			.setSection('knowledge-map-remove')
			.onClick(() => this.confirmNodeRemoval(node)));
		menu.showAtMouseEvent(event);
	}

	private confirmNodeRemoval(node: GlobeCanvasNode): void {
		new GlobeNodeRemoveDialog(this.app, [node.label], () => {
			this.removeNodesFromCanvas([node.id]);
		}).open();
	}

	private removeNodesFromCanvas(nodeIds: readonly string[]): void {
		const ids = new Set(nodeIds);
		const removed = this.document.nodes.filter((node) => ids.has(node.id));
		if (removed.length === 0) return;
		this.document = removeGlobeCanvasNodes(this.document, ids);
		this.selectedNodeIds.clear();
		this.queueDocumentSave();
		this.renderGlobe();
		new Notice(removed.length === 1
			? '已从当前3维画布移除节点，仓库中的源内容未删除。'
			: `已从当前3维画布移除 ${removed.length} 个节点，仓库中的源内容均未删除。`);
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (!this.isActiveGlobeView() || this.isTextEntryTarget(event.target)) return;
		if (event.code === 'Space') {
			event.preventDefault();
			this.renderer?.setSpacePressed(true);
			return;
		}
		if (event.key !== 'Backspace' && event.key !== 'Delete' || this.selectedNodeIds.size === 0) return;
		event.preventDefault();
		this.removeNodesFromCanvas([...this.selectedNodeIds]);
	}

	private handleKeyUp(event: KeyboardEvent): void {
		if (event.code !== 'Space') return;
		this.renderer?.setSpacePressed(false);
	}

	private isActiveGlobeView(): boolean {
		return this.app.workspace.getActiveViewOfType(GlobeView) === this;
	}

	private isTextEntryTarget(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && Boolean(target.closest(
			'input, textarea, [contenteditable="true"], .modal-container',
		));
	}

	private setCanvasChildRelationship(targetPath: string, isChild: boolean): void {
		if (!this.file) return;
		this.plugin.store.addCanvasReference(this.file.path, targetPath);
		const changed = isChild
			? this.plugin.store.clearParentKnowledgeCanvas(targetPath, this.file.path)
			: this.plugin.store.setParentKnowledgeCanvas(targetPath, this.file.path);
		new Notice(changed
			? isChild ? '已取消子画布关系，引用关系仍然保留。' : '已设为当前画布的子画布。'
			: '无法修改画布父子关系。');
	}

	private async setFolderChildRelationship(folderPath: string, childPaths: readonly string[]): Promise<void> {
		if (!this.file) return;
		if (childPaths.length > 0) {
			let changed = false;
			for (const childPath of childPaths) {
				this.plugin.store.addCanvasReference(this.file.path, childPath);
				changed = this.plugin.store.clearParentKnowledgeCanvas(childPath, this.file.path) || changed;
			}
			new Notice(changed ? '已取消子画布关系，引用关系仍然保留。' : '无法修改画布父子关系。');
			return;
		}
		await this.plugin.openOrChooseChildCanvas(this.file.path, folderPath);
	}

	private addNodeAppearanceControls(menu: Menu, node: GlobeCanvasNode, anchorEvent: MouseEvent): void {
		const appearance = mergeKnowledgeCanvasNodeAppearance(node.appearance);
		menu.addSeparator();
		menu.addItem((item) => item
			.setTitle('颜色')
			.setIcon('palette')
			.setIsLabel(true)
			.setSection('knowledge-map-style'));
		for (const option of GLOBE_NODE_PALETTES) {
			menu.addItem((item) => item
				.setTitle(this.createNodeStyleOption('color', option.id, option.label, appearance.palette === option.id))
				.setSection('knowledge-map-style')
				.onClick(() => this.applyNodeAppearance(node.id, { palette: option.id, customColor: undefined })));
		}
		const usesMore = appearance.palette === 'custom'
			|| GLOBE_NODE_EXTENDED_PALETTES.some((option) => option.id === appearance.palette);
		menu.addItem((item) => item
			.setTitle(this.createNodeStyleOption('color', 'more', '更多颜色', usesMore))
			.setSection('knowledge-map-style')
			.onClick(() => this.showExpandedNodePalette(node, anchorEvent)));
		menu.addItem((item) => item
			.setTitle('形状')
			.setIcon('shapes')
			.setIsLabel(true)
			.setSection('knowledge-map-style'));
		for (const option of GLOBE_NODE_SHAPES) {
			menu.addItem((item) => item
				.setTitle(this.createNodeStyleOption('shape', option.id, option.label, appearance.shape === option.id))
				.setSection('knowledge-map-style')
				.onClick(() => this.applyNodeAppearance(node.id, { shape: option.id })));
		}
		menu.addItem((item) => item
			.setTitle('选择图标…')
			.setIcon('smile-plus')
			.setSection('knowledge-map-icon-picker')
			.onClick(() => new ManagedNodeIconDialog(this.app, appearance.icon, (icon) => {
				this.applyNodeAppearance(node.id, { icon });
			}).open()));
	}

	private showExpandedNodePalette(node: GlobeCanvasNode, anchorEvent: MouseEvent): void {
		window.setTimeout(() => {
			const current = this.document.nodes.find((candidate) => candidate.id === node.id);
			if (!current) return;
			const appearance = mergeKnowledgeCanvasNodeAppearance(current.appearance);
			const menu = Menu.forEvent(anchorEvent).setUseNativeMenu(false);
			menu.addItem((item) => item
				.setTitle('更多颜色')
				.setIcon('palette')
				.setIsLabel(true)
				.setSection('knowledge-map-style-more-header'));
			const customColors = this.plugin.store.getCustomNodeColors();
			if (customColors.length > 0) {
				menu.addItem((item) => item
					.setTitle('我的颜色')
					.setIcon('bookmark')
					.setIsLabel(true)
					.setSection('knowledge-map-style-more'));
				for (const color of customColors) {
					menu.addItem((item) => item
						.setTitle(this.createCustomColorOption(color, appearance.palette === 'custom' && appearance.customColor === color, menu))
						.setSection('knowledge-map-style-more')
						.onClick(() => this.applyNodeAppearance(node.id, { palette: 'custom', customColor: color })));
				}
			}
			menu.addItem((item) => item
				.setTitle('预设颜色')
				.setIcon('swatch-book')
				.setIsLabel(true)
				.setSection('knowledge-map-style-more'));
			for (const option of GLOBE_NODE_EXTENDED_PALETTES) {
				menu.addItem((item) => item
					.setTitle(this.createNodeStyleOption('color', option.id, option.label, appearance.palette === option.id))
					.setSection('knowledge-map-style-more')
					.onClick(() => this.applyNodeAppearance(node.id, { palette: option.id, customColor: undefined })));
			}
			menu.addItem((item) => item
				.setTitle('自定义')
				.setIcon('pipette')
				.setIsLabel(true)
				.setSection('knowledge-map-style-more'));
			menu.addItem((item) => item
				.setTitle(this.createNodeStyleOption('color', 'picker', '打开色盘', false))
				.setSection('knowledge-map-style-more')
				.onClick(() => this.openCustomNodeColorPicker(node.id)));
			menu.showAtMouseEvent(anchorEvent);
		}, 0);
	}

	private applyNodeAppearance(nodeId: string, patch: Partial<KnowledgeCanvasNodeAppearance>): void {
		const node = this.document.nodes.find((candidate) => candidate.id === nodeId);
		if (!node) return;
		const appearance = mergeKnowledgeCanvasNodeAppearance(node.appearance, patch);
		this.document = setGlobeCanvasNodeAppearance(this.document, nodeId, appearance);
		this.renderer?.updateNodeAppearance(nodeId, appearance);
		this.queueDocumentSave();
	}

	private openCustomNodeColorPicker(nodeId: string): void {
		const node = this.document.nodes.find((candidate) => candidate.id === nodeId);
		if (!node) return;
		const appearance = mergeKnowledgeCanvasNodeAppearance(node.appearance);
		new CustomNodeColorDialog(this.app, appearance.customColor ?? '#4b82b5', (color) => {
			this.plugin.store.addCustomNodeColor(color);
			this.applyNodeAppearance(nodeId, { palette: 'custom', customColor: color });
		}).open();
	}

	private createNodeStyleOption(
		kind: 'color' | 'shape',
		value: KnowledgeCanvasNodePalette | KnowledgeCanvasNodeShape | 'more' | 'picker',
		label: string,
		active: boolean,
	): DocumentFragment {
		return createFragment((fragment) => {
			const preview = fragment.createSpan({
				cls: ['knowledge-map-style-preview', `is-${kind}`, `is-${value}`, active ? 'is-active' : ''].filter(Boolean).join(' '),
			});
			preview.setAttribute('aria-hidden', 'true');
			fragment.createSpan({ cls: 'knowledge-map-style-option-label', text: label });
		});
	}

	private createCustomColorOption(color: string, active: boolean, menu: Menu): DocumentFragment {
		return createFragment((fragment) => {
			const preview = fragment.createSpan({
				cls: ['knowledge-map-style-preview', 'is-color', 'is-custom', active ? 'is-active' : ''].filter(Boolean).join(' '),
			});
			preview.style.setProperty('--knowledge-map-custom-color', color);
			preview.setAttribute('aria-hidden', 'true');
			preview.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.plugin.store.removeCustomNodeColor(color);
				menu.close();
				new Notice('自定义颜色已删除。');
			});
			fragment.createSpan({ cls: 'knowledge-map-style-option-label', text: `${color}；右键删除` });
		});
	}

	private async revealInFileNavigation(file: TAbstractFile): Promise<void> {
		const leaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!leaf) {
			new Notice('文件列表当前未打开。');
			return;
		}
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view as unknown as { revealInFolder?: (target: TAbstractFile) => Promise<void> | void };
		await view.revealInFolder?.(file);
	}

	private async copyVaultPath(path: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(path);
			new Notice('路径已复制。');
		} catch {
			new Notice('无法复制路径。');
		}
	}

	private collectDroppedItems(transfer: DataTransfer | null): TAbstractFile[] {
		const items = new Map<string, TAbstractFile>();
		const draggable = (this.app as unknown as {
			dragManager?: { draggable?: unknown };
		}).dragManager?.draggable;
		this.addNestedCandidate(items, draggable, 0, new WeakSet<object>());
		if (transfer) {
			for (const type of new Set(['text/plain', 'text/uri-list', 'application/json', ...transfer.types])) {
				try {
					this.addDropText(items, transfer.getData(type));
				} catch {
					// Some Electron drag payload types cannot be read directly.
				}
			}
		}
		return [...items.values()];
	}

	private addNestedCandidate(
		items: Map<string, TAbstractFile>,
		candidate: unknown,
		depth: number,
		seen: WeakSet<object>,
	): void {
		if (candidate === null || candidate === undefined || depth > 5) return;
		this.addCandidate(items, candidate);
		if (typeof candidate !== 'object' || seen.has(candidate)) return;
		seen.add(candidate);
		if (Array.isArray(candidate)) {
			for (const child of candidate) this.addNestedCandidate(items, child, depth + 1, seen);
			return;
		}
		const record = candidate as Record<string, unknown>;
		for (const key of ['file', 'files', 'folder', 'folders', 'item', 'items', 'path', 'paths', 'sourcePath']) {
			this.addNestedCandidate(items, record[key], depth + 1, seen);
		}
	}

	private addDropText(items: Map<string, TAbstractFile>, raw: string): void {
		const text = raw.trim();
		if (!text) return;
		try {
			this.addNestedCandidate(items, JSON.parse(text), 0, new WeakSet<object>());
		} catch {
			// Obsidian normally transfers links or paths, not JSON.
		}
		for (const match of text.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g)) {
			this.addLinkText(items, match[1] ?? '');
		}
		for (const line of text.split(/\r?\n/)) this.addLinkText(items, line);
	}

	private addLinkText(items: Map<string, TAbstractFile>, raw: string): void {
		let candidate = raw.trim().replace(/^<|>$/g, '');
		if (!candidate) return;
		try {
			if (candidate.startsWith('obsidian://')) {
				const url = new URL(candidate);
				candidate = url.searchParams.get('file') ?? url.searchParams.get('path') ?? '';
			}
			candidate = decodeURIComponent(candidate);
		} catch {
			// Keep an undecodable path unchanged.
		}
		candidate = candidate
			.replace(/^file:\/\//, '')
			.replace(/^\[\[|]]$/g, '')
			.replace(/^\/+|\/+$/g, '')
			.trim();
		if (!candidate) return;
		const direct = this.app.vault.getAbstractFileByPath(candidate);
		if (direct) this.addCandidate(items, direct);
		else {
			const linked = this.app.metadataCache.getFirstLinkpathDest(candidate, this.file?.path ?? '');
			if (linked) this.addCandidate(items, linked);
		}
	}

	private addCandidate(items: Map<string, TAbstractFile>, candidate: unknown): void {
		let file: TAbstractFile | null = null;
		if (candidate instanceof TAbstractFile) file = candidate;
		else if (typeof candidate === 'string') file = this.app.vault.getAbstractFileByPath(candidate);
		else if (candidate && typeof candidate === 'object' && 'path' in candidate) {
			const path = (candidate as { path?: unknown }).path;
			if (typeof path === 'string') file = this.app.vault.getAbstractFileByPath(path);
		}
		if (file instanceof TFile || file instanceof TFolder) items.set(file.path, file);
	}

	private queueDocumentSave(): void {
		this.data = serializeGlobeCanvasDocument(this.document);
		this.requestSave();
	}
}
