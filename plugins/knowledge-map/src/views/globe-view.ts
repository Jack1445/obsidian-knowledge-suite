import {
	Notice,
	setIcon,
	TAbstractFile,
	TFile,
	TFolder,
	TextFileView,
	type WorkspaceLeaf,
} from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import type { FolderGraph } from '../core/graph';
import { GlobeRenderer } from '../globe/globe-renderer';
import {
	addGlobeCanvasNodes,
	createEmptyGlobeCanvasDocument,
	parseGlobeCanvasDocument,
	serializeGlobeCanvasDocument,
	setGlobeCanvasNodePosition,
	type GlobeCanvasNode,
} from '../globe/globe-canvas-document';

export const KNOWLEDGE_MAP_GLOBE_VIEW_TYPE = 'knowledge-map-globe-view';

export class GlobeView extends TextFileView {
	private document = createEmptyGlobeCanvasDocument();
	private renderer: GlobeRenderer | null = null;
	private titleEl!: HTMLElement;
	private globeEl!: HTMLElement;

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
		const toolbar = this.contentEl.createDiv({ cls: 'knowledge-map-globe__toolbar' });
		const back = toolbar.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': '返回父画布' },
		});
		setIcon(back, 'arrow-left');
		back.addEventListener('click', () => {
			if (this.file) void this.plugin.openParentCanvas(this.file.path);
		});
		this.titleEl = toolbar.createDiv({ cls: 'knowledge-map-globe__title' });
		const manage = toolbar.createEl('button', { text: '创建子画布' });
		manage.addEventListener('click', () => {
			if (!this.file) return;
			const state = this.plugin.store.getKnowledgeCanvas(this.file.path);
			this.plugin.openCanvasManager(state?.folderPath ?? '/', this.file.path);
		});
		this.globeEl = this.contentEl.createDiv({ cls: 'knowledge-map-globe__stage' });
		this.registerDomEvent(this.globeEl, 'dragenter', (event) => this.handleDragOver(event));
		this.registerDomEvent(this.globeEl, 'dragover', (event) => this.handleDragOver(event));
		this.registerDomEvent(this.globeEl, 'dragleave', (event) => {
			if (!this.globeEl.contains(event.relatedTarget as Node | null)) {
				this.globeEl.removeClass('is-dragging-over');
			}
		});
		this.registerDomEvent(this.globeEl, 'drop', (event) => this.handleDrop(event));
		this.renderGlobe();
	}

	async onClose(): Promise<void> {
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
		this.titleEl?.setText(this.file?.basename ?? '3维画布');
		const validNodes = this.document.nodes.filter((node) => {
			return this.app.vault.getAbstractFileByPath(node.path) instanceof TAbstractFile;
		});
		const graph: FolderGraph = {
			folderPath: this.plugin.store.getKnowledgeCanvas(this.file?.path ?? '')?.folderPath ?? '/',
			nodes: validNodes,
			edges: [],
		};
		this.renderer = new GlobeRenderer({
			container: this.globeEl,
			graph,
			positions: Object.fromEntries(this.document.nodes.map((node) => [node.id, node.position])),
			onNodeActivate: (node, event) => {
				const canvasState = this.plugin.store.getKnowledgeCanvas(node.path);
				if (canvasState) {
					const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
					void this.plugin.openManagedCanvasFile(node.path, newLeaf, this.file?.path ?? '');
					return;
				}
				if (node.kind === 'folder' && this.file) {
					void this.plugin.openOrCreateChildGlobeCanvas(this.file.path, node.path);
					return;
				}
				const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
				void this.app.workspace.openLinkText(node.path, this.file?.path ?? '', newLeaf);
			},
			onPositionChange: (nodeId, position) => {
				this.document = setGlobeCanvasNodePosition(this.document, nodeId, position);
				this.queueDocumentSave();
			},
		});
		const empty = this.globeEl.createDiv({
			cls: 'knowledge-map-globe__empty',
			text: '将仓库中的文件或文件夹拖到地球表面',
		});
		empty.toggleClass('is-hidden', validNodes.length > 0);
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
