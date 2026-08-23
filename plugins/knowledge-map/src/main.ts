import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { KnowledgeMapStore } from './data/store';
import { ExcalidrawIntegration } from './integrations/excalidraw';
import { KnowledgeMapSettingTab } from './settings/settings-tab';
import { KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, GlobeView } from './views/globe-view';
import { KNOWLEDGE_MAP_VIEW_TYPE, KnowledgeMapView } from './views/knowledge-map-view';
import { CanvasManagerModal } from './ui/canvas-manager-modal';
import { KnowledgeFormulaDialog, renderLatexToSvg } from './ui/formula-dialog';

export default class KnowledgeMapPlugin extends Plugin {
	store!: KnowledgeMapStore;
	excalidraw!: ExcalidrawIntegration;

	async onload(): Promise<void> {
		this.store = new KnowledgeMapStore(this);
		await this.store.load();
		this.excalidraw = new ExcalidrawIntegration(this.app, this.store);

		this.registerView(KNOWLEDGE_MAP_VIEW_TYPE, (leaf) => new KnowledgeMapView(leaf, this));
		this.registerView(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, (leaf) => new GlobeView(leaf, this));
		this.addRibbonIcon('network', 'Open 2d knowledge map', () => void this.activateView());
		this.addRibbonIcon('globe-2', 'Open knowledge globe', () => void this.activateGlobe('/'));
		this.addRibbonIcon('layout-dashboard', 'Manage knowledge canvases', () => {
			new CanvasManagerModal(this, '/', null, null).open();
		});
		this.addCommand({
			id: 'open-map',
			name: 'Open 2d map',
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: 'create-knowledge-canvas',
			name: 'Create knowledge canvas',
			callback: () => void this.excalidraw.createKnowledgeCanvas('/'),
		});
		this.addCommand({
			id: 'new-blank-canvas',
			name: 'Create plain Excalidraw canvas',
			callback: () => void this.excalidraw.createBlank('/'),
		});
		this.addCommand({
			id: 'refresh-knowledge-canvas',
			name: 'Refresh active knowledge canvas',
			callback: () => void this.excalidraw.refreshActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'knowledge-canvas-back',
			name: 'Go back in active knowledge canvas',
			callback: () => void this.excalidraw.goBackActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'reset-knowledge-canvas-layout',
			name: 'Restore default layout in active knowledge canvas',
			callback: () => void this.excalidraw.resetActiveKnowledgeCanvasLayout(),
		});
		this.addCommand({
			id: 'insert-or-edit-knowledge-canvas-formula',
			name: 'Insert or edit formula in active knowledge canvas',
			callback: () => void this.excalidraw.editFormulaInActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'toggle-knowledge-canvas-text-bold',
			name: 'Toggle bold for selected text in active knowledge canvas',
			callback: () => void this.excalidraw.toggleBoldInActiveKnowledgeCanvas(),
		});
		this.addCommand({
			id: 'open-globe',
			name: 'Open knowledge globe',
			callback: () => void this.activateGlobe('/'),
		});
		this.addCommand({
			id: 'manage-canvases',
			name: 'Manage knowledge canvases',
			callback: () => new CanvasManagerModal(this, '/', null, null).open(),
		});
		this.addSettingTab(new KnowledgeMapSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerVaultEvents();
			this.excalidraw.bindOpenViews();
		});
	}

	async activateGlobe(folderPath: string): Promise<void> {
		await this.activateGlobeView(folderPath);
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
		else new Notice('Could not open knowledge map.');
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

	private async activateGlobeView(folderPath: string): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_GLOBE_VIEW_TYPE)[0];
		let leaf: WorkspaceLeaf;
		if (existing) {
			leaf = existing;
		} else {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: KNOWLEDGE_MAP_GLOBE_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		if (leaf.view instanceof GlobeView) leaf.view.openFolder(folderPath);
		else new Notice('Could not open knowledge globe.');
	}
}
