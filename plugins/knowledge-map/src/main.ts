import { Notice, Plugin, TFile, type WorkspaceLeaf } from 'obsidian';
import { KnowledgeMapStore } from './data/store';
import { ExcalidrawIntegration } from './integrations/excalidraw';
import { KnowledgeMapSettingTab } from './settings/settings-tab';
import { KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, GlobeView } from './views/globe-view';
import { KNOWLEDGE_MAP_VIEW_TYPE, KnowledgeMapView } from './views/knowledge-map-view';
import {
	CanvasTreeView,
	KNOWLEDGE_CANVAS_TREE_VIEW_TYPE,
} from './views/canvas-tree-view';
import { CanvasManagerModal } from './ui/canvas-manager-modal';
import {
	FolderCanvasTypeDialog,
	type FolderCanvasTypeOption,
} from './ui/folder-canvas-type-dialog';
import { KnowledgeFormulaDialog, renderLatexToSvg } from './ui/formula-dialog';
import { folderDisplayName, normalizeFolderPath } from './core/paths';
import {
	createEmptyGlobeCanvasDocument,
	GLOBE_CANVAS_FILE_EXTENSION,
	serializeGlobeCanvasDocument,
} from './globe/globe-canvas-document';

const EXCALIDRAW_VIEW_TYPE = 'excalidraw';

export default class KnowledgeMapPlugin extends Plugin {
	store!: KnowledgeMapStore;
	excalidraw!: ExcalidrawIntegration;

	async onload(): Promise<void> {
		this.store = new KnowledgeMapStore(this);
		await this.store.load();
		this.excalidraw = new ExcalidrawIntegration(this.app, this.store);

		this.registerView(KNOWLEDGE_MAP_VIEW_TYPE, (leaf) => new KnowledgeMapView(leaf, this));
		this.registerView(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, (leaf) => new GlobeView(leaf, this));
		this.registerExtensions([GLOBE_CANVAS_FILE_EXTENSION], KNOWLEDGE_MAP_GLOBE_VIEW_TYPE);
		this.registerView(KNOWLEDGE_CANVAS_TREE_VIEW_TYPE, (leaf) => new CanvasTreeView(leaf, this));
		this.addRibbonIcon('layout-dashboard', '管理画布', () => {
			this.openActiveCanvasManager();
		});
		this.addRibbonIcon('folder-tree', '打开画布树', () => void this.activateCanvasTree());
		this.addCommand({
			id: 'create-knowledge-canvas',
			name: '创建结构画布',
			callback: () => void this.excalidraw.createKnowledgeCanvas('/'),
		});
		this.addCommand({
			id: 'refresh-knowledge-canvas',
			name: '刷新当前画布',
			callback: () => void this.excalidraw.refreshActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'knowledge-canvas-back',
			name: '返回当前画布的上一层',
			callback: () => void this.excalidraw.goBackActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'reset-knowledge-canvas-layout',
			name: '恢复当前画布的默认布局',
			callback: () => void this.excalidraw.resetActiveKnowledgeCanvasLayout(),
		});
		this.addCommand({
			id: 'insert-or-edit-knowledge-canvas-formula',
			name: '在当前画布中插入或编辑公式',
			callback: () => void this.excalidraw.editFormulaInActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'toggle-knowledge-canvas-text-bold',
			name: '切换当前画布所选文字的粗体',
			callback: () => void this.excalidraw.toggleBoldInActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'manage-canvases',
			name: '管理画布',
			callback: () => this.openActiveCanvasManager(),
		});
		this.addCommand({
			id: 'open-canvas-tree',
			name: '打开画布树',
			callback: () => void this.activateCanvasTree(),
		});
		this.addSettingTab(new KnowledgeMapSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerVaultEvents();
			this.excalidraw.bindOpenViews();
		});
	}

	openCanvasManager(folderPath: string, parentCanvasPath?: string): void {
		new CanvasManagerModal(this, folderPath, null, null, parentCanvasPath).open();
	}

	async createGlobeCanvas(folderPath: string, parentCanvasPath?: string): Promise<string | null> {
		const normalized = normalizeFolderPath(folderPath);
		const timestamp = new Date().toISOString().replaceAll(':', '-').replace('T', ' ').slice(0, 19);
		const baseName = `${folderDisplayName(normalized)} 3维画布 ${timestamp}`;
		let index = 1;
		let filePath = this.globeCanvasPath(normalized, baseName);
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			index += 1;
			filePath = this.globeCanvasPath(normalized, `${baseName} ${index}`);
		}
		try {
			const file = await this.app.vault.create(
				filePath,
				serializeGlobeCanvasDocument(createEmptyGlobeCanvasDocument()),
			);
			this.store.registerKnowledgeCanvas(file.path, normalized, parentCanvasPath, '3d');
			await this.store.flush();
			await this.openManagedCanvasFile(file.path, true, parentCanvasPath ?? '');
			new Notice(parentCanvasPath ? '子3维画布已创建。' : '3维画布已创建。');
			return file.path;
		} catch {
			new Notice('无法创建3维画布文件。');
			return null;
		}
	}

	async openOrChooseChildCanvas(parentCanvasPath: string, folderPath: string): Promise<void> {
		const options: FolderCanvasTypeOption[] = [
			{ canvasType: '2d' },
			{ canvasType: '3d' },
		];
		for (const option of options) {
			const existingPath = this.store.findChildKnowledgeCanvas(
				parentCanvasPath,
				folderPath,
				option.canvasType,
			);
			if (!existingPath) continue;
			if (this.app.vault.getAbstractFileByPath(existingPath) instanceof TFile) {
				option.existingPath = existingPath;
			} else {
				this.store.removeKnowledgeCanvas(existingPath);
			}
		}

		const existingOptions = options.filter((option) => option.existingPath);
		if (existingOptions.length === 1) {
			await this.openFolderCanvasOption(parentCanvasPath, folderPath, existingOptions[0]!);
			return;
		}

		new FolderCanvasTypeDialog(
			this.app,
			folderDisplayName(normalizeFolderPath(folderPath)),
			options,
			(option) => void this.openFolderCanvasOption(parentCanvasPath, folderPath, option),
		).open();
	}

	private async openFolderCanvasOption(
		parentCanvasPath: string,
		folderPath: string,
		option: FolderCanvasTypeOption,
	): Promise<void> {
		if (option.existingPath) {
			this.store.addCanvasReference(parentCanvasPath, option.existingPath);
			await this.store.flush();
			await this.openManagedCanvasFile(option.existingPath, true, parentCanvasPath);
			return;
		}
		const createdPath = option.canvasType === '3d'
			? await this.createGlobeCanvas(folderPath, parentCanvasPath)
			: await this.excalidraw.createKnowledgeCanvas(folderPath, parentCanvasPath);
		if (!createdPath) return;
		this.store.addCanvasReference(parentCanvasPath, createdPath);
		await this.store.flush();
	}

	async openManagedCanvasFile(
		filePath: string,
		openInNewLeaf = false,
		sourcePath = '',
	): Promise<boolean> {
		const state = this.store.getKnowledgeCanvas(filePath);
		const viewType = state?.canvasType === '3d' ? KNOWLEDGE_MAP_GLOBE_VIEW_TYPE : EXCALIDRAW_VIEW_TYPE;
		const existing = this.app.workspace.getLeavesOfType(viewType).find((leaf) => {
			return (leaf.view as unknown as { file?: TFile | null }).file?.path === filePath;
		});
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			this.app.workspace.setActiveLeaf(existing, { focus: true });
			return true;
		}
		await this.app.workspace.openLinkText(filePath, sourcePath, openInNewLeaf);
		return false;
	}

	async openParentCanvas(childCanvasPath: string): Promise<void> {
		const childState = this.store.getKnowledgeCanvas(childCanvasPath);
		const parentPath = childState?.parentCanvasPath;
		if (!parentPath) {
			new Notice('当前已经是顶层画布。');
			return;
		}
		const parentFile = this.app.vault.getAbstractFileByPath(parentPath);
		if (!(parentFile instanceof TFile)) {
			new Notice('找不到父画布。');
			return;
		}
		const alreadyOpen = await this.openManagedCanvasFile(parentFile.path, false, childCanvasPath);
		if (alreadyOpen) return;
		if (this.store.getKnowledgeCanvas(parentFile.path)?.canvasType === '2d') {
			await this.excalidraw.centerKnowledgeCanvasFolderNode(
				parentFile.path,
				childState.history[0] ?? childState.folderPath,
			);
		} else {
			await this.centerGlobeCanvasNode(parentFile.path, childState.folderPath);
		}
	}

	async editInlineFormula(initialLatex = ''): Promise<{
		latex: string;
		dataURL: string;
		width: number;
		height: number;
	} | null> {
		const ownerDocument = this.app.workspace.containerEl.ownerDocument;
		if (ownerDocument.querySelector('.knowledge-map-formula-dialog')) return null;
		const view = ownerDocument.defaultView ?? window;
		return new Promise((resolve) => {
			let settled = false;
			const finish = (value: {
				latex: string;
				dataURL: string;
				width: number;
				height: number;
			} | null): void => {
				if (settled) return;
				settled = true;
				resolve(value);
			};
			const dialog = new KnowledgeFormulaDialog({
				document: ownerDocument,
				initialLatex,
				anchor: {
					left: Math.max(12, (view.innerWidth - 520) / 2),
					bottom: 170,
				},
				onConfirm: async (latex) => {
					const normalized = latex.trim();
					if (!normalized) {
						finish(null);
						return;
					}
					try {
						const rendered = await renderLatexToSvg(normalized, ownerDocument);
						finish(rendered ? { latex: normalized, ...rendered } : null);
					} catch {
						finish(null);
					}
				},
				onCancel: () => finish(null),
			});
			dialog.open();
		});
	}

	async activateView(folderPath = '/'): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)[0];
		let leaf: WorkspaceLeaf;
		if (existing) {
			leaf = existing;
		} else {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: KNOWLEDGE_MAP_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		if (leaf.view instanceof KnowledgeMapView) leaf.view.openFolder(folderPath);
		else new Notice('无法打开2维画布。');
	}

	async activateCanvasTree(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(KNOWLEDGE_CANVAS_TREE_VIEW_TYPE)[0];
		const leaf = existing ?? this.app.workspace.getLeftLeaf(false);
		if (!leaf) {
			new Notice('无法打开画布树。');
			return;
		}
		if (!existing) {
			await leaf.setViewState({ type: KNOWLEDGE_CANVAS_TREE_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	onunload(): void {
		void this.store.flush();
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)) {
			if (leaf.view instanceof KnowledgeMapView) leaf.view.refresh();
		}
	}

	private registerVaultEvents(): void {
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			window.setTimeout(() => this.excalidraw.bindLeaf(leaf), 100);
			for (const treeLeaf of this.app.workspace.getLeavesOfType(KNOWLEDGE_CANVAS_TREE_VIEW_TYPE)) {
				if (treeLeaf.view instanceof CanvasTreeView) treeLeaf.view.refresh();
			}
		}));
		this.registerEvent(this.app.workspace.on('file-open', () => {
			window.setTimeout(() => this.excalidraw.bindOpenViews(), 100);
		}));
		this.registerEvent(this.app.vault.on('create', () => this.refreshViews()));
		this.registerEvent(this.app.vault.on('modify', () => this.refreshViews()));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			this.store.removePath(file.path);
			this.refreshViews();
		}));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			this.store.migratePath(oldPath, file.path);
			for (const leaf of this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)) {
				if (leaf.view instanceof KnowledgeMapView) leaf.view.handlePathRename(oldPath, file.path);
			}
		}));
		this.registerEvent(this.app.metadataCache.on('changed', () => this.refreshViews()));
		this.registerEvent(this.app.metadataCache.on('resolved', () => this.refreshViews()));
	}

	private openActiveCanvasManager(): void {
		// The global manager creates top-level canvases. Child canvases are created
		// only from an explicit canvas action (folder node or "创建子画布").
		this.openCanvasManager('/');
	}

	private async centerGlobeCanvasNode(canvasPath: string, nodePath: string): Promise<void> {
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const leaf = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE).find((candidate) => {
				return (candidate.view as unknown as { file?: TFile | null }).file?.path === canvasPath;
			});
			if (leaf?.view instanceof GlobeView && leaf.view.focusPath(nodePath)) return;
			await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
		}
	}

	private globeCanvasPath(folderPath: string, fileName: string): string {
		const name = `${fileName}.${GLOBE_CANVAS_FILE_EXTENSION}`;
		return folderPath === '/' ? name : `${folderPath}/${name}`;
	}
}
