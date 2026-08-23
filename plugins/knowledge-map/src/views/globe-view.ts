import { ItemView, Notice, setIcon, type WorkspaceLeaf } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import { ROOT_PATH, type MapNode } from '../core/graph';
import { folderDisplayName, normalizeFolderPath, parentFolderPath } from '../core/paths';
import { GlobeRenderer } from '../globe/globe-renderer';
import { VaultGraphBuilder } from '../obsidian/vault-graph-builder';

export const KNOWLEDGE_MAP_GLOBE_VIEW_TYPE = 'knowledge-map-globe-view';

export class GlobeView extends ItemView {
	private currentPath = ROOT_PATH;
	private renderer: GlobeRenderer | null = null;
	private graphBuilder: VaultGraphBuilder;
	private titleEl!: HTMLElement;
	private globeEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: KnowledgeMapPlugin) {
		super(leaf);
		this.graphBuilder = new VaultGraphBuilder(this.app);
	}

	getViewType(): string {
		return KNOWLEDGE_MAP_GLOBE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Knowledge globe';
	}

	getIcon(): string {
		return 'globe-2';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('knowledge-map-globe');
		const toolbar = this.contentEl.createDiv({ cls: 'knowledge-map-globe__toolbar' });
		const back = toolbar.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Open parent folder' } });
		setIcon(back, 'arrow-up');
		back.addEventListener('click', () => {
			const parent = parentFolderPath(this.currentPath);
			if (parent !== null) this.openFolder(parent);
		});
		this.titleEl = toolbar.createDiv({ cls: 'knowledge-map-globe__title' });
		const mapButton = toolbar.createEl('button', { text: '2D map' });
		mapButton.addEventListener('click', () => void this.plugin.activateView(this.currentPath));
		this.globeEl = this.contentEl.createDiv({ cls: 'knowledge-map-globe__stage' });
		this.renderGlobe();
	}

	async onClose(): Promise<void> {
		this.renderer?.destroy();
	}

	openFolder(path: string): void {
		this.currentPath = normalizeFolderPath(path);
		this.renderGlobe();
	}

	private renderGlobe(): void {
		if (!this.globeEl) return;
		this.renderer?.destroy();
		this.globeEl.empty();
		this.titleEl.setText(`${folderDisplayName(this.currentPath)} · Globe`);
		const graph = this.graphBuilder.build(this.currentPath, this.plugin.store.settings.showExternalLinks);
		this.renderer = new GlobeRenderer({
			container: this.globeEl,
			graph,
			positions: this.plugin.store.getGlobePositions(this.currentPath),
			onNodeActivate: (node, event) => this.activateNode(node, event),
			onPositionChange: (nodeId, position) => this.plugin.store.setGlobePosition(this.currentPath, nodeId, position),
		});
		void this.renderer.mount().catch(() => {
			new Notice('The globe could not start. Check webgl support and the developer console.');
		});
	}

	private activateNode(node: MapNode, event: PointerEvent): void {
		if (node.kind === 'folder') {
			this.openFolder(node.path);
			return;
		}
		const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
		void this.app.workspace.openLinkText(node.path, this.currentPath, newLeaf);
	}
}
