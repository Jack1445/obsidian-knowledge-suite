import { ItemView, Notice, setIcon, type WorkspaceLeaf } from 'obsidian';
import type KnowledgeMapPlugin from '../main';
import { ROOT_PATH, type FolderGraph, type MapNode, type SavedNodePosition } from '../core/graph';
import { normalizeFolderPath, parentFolderPath, remapPath } from '../core/paths';
import { VaultGraphBuilder } from '../obsidian/vault-graph-builder';
import { createInitialPositions } from '../services/initial-layout';
import { NavigationHistory } from '../services/navigation-history';
import { CanvasManagerModal } from '../ui/canvas-manager-modal';
import { GraphRenderer } from './graph-renderer';

export const KNOWLEDGE_MAP_VIEW_TYPE = 'knowledge-map-view';

export class KnowledgeMapView extends ItemView {
	private readonly graphBuilder: VaultGraphBuilder;
	private readonly history = new NavigationHistory();
	private currentPath = ROOT_PATH;
	private renderer: GraphRenderer | null = null;
	private refreshTimer: number | null = null;
	private toolbarEl!: HTMLElement;
	private breadcrumbEl!: HTMLElement;
	private graphEl!: HTMLElement;
	private backButton!: HTMLButtonElement;
	private forwardButton!: HTMLButtonElement;
	private lastGraph: ReturnType<VaultGraphBuilder['build']> | null = null;
	private lastPositions: ReturnType<typeof createInitialPositions> | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: KnowledgeMapPlugin) {
		super(leaf);
		this.graphBuilder = new VaultGraphBuilder(this.app);
	}

	getViewType(): string {
		return KNOWLEDGE_MAP_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Knowledge map';
	}

	getIcon(): string {
		return 'network';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('knowledge-map');
		this.buildToolbar();
		this.graphEl = this.contentEl.createDiv({ cls: 'knowledge-map__graph' });
		this.history.push(this.currentPath);
		this.renderMap();
	}

	async onClose(): Promise<void> {
		this.renderer?.destroy();
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
	}

	refresh(): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.renderMap();
		}, 100);
	}

	handlePathRename(oldPath: string, newPath: string): void {
		this.currentPath = remapPath(this.currentPath, oldPath, newPath);
		this.history.migratePath(oldPath, newPath);
		this.refresh();
	}

	openFolder(path: string, addToHistory = true): void {
		const normalized = normalizeFolderPath(path);
		if (normalized !== ROOT_PATH && !this.app.vault.getFolderByPath(normalized)) {
			new Notice('That folder no longer exists. Returning to the vault root.');
			this.currentPath = ROOT_PATH;
		} else {
			this.currentPath = normalized;
		}
		if (addToHistory) this.history.push(this.currentPath);
		this.renderMap();
	}

	private buildToolbar(): void {
		this.toolbarEl = this.contentEl.createDiv({ cls: 'knowledge-map__toolbar' });
		const historyGroup = this.toolbarEl.createDiv({ cls: 'knowledge-map__toolbar-group' });
		this.backButton = this.iconButton(historyGroup, 'arrow-left', 'Go back', () => {
			const path = this.history.back();
			if (path) this.openFolder(path, false);
		});
		this.forwardButton = this.iconButton(historyGroup, 'arrow-right', 'Go forward', () => {
			const path = this.history.forward();
			if (path) this.openFolder(path, false);
		});
		this.iconButton(historyGroup, 'home', 'Open vault root', () => this.openFolder(ROOT_PATH));
		this.breadcrumbEl = this.toolbarEl.createDiv({ cls: 'knowledge-map__breadcrumbs' });

		const actions = this.toolbarEl.createDiv({ cls: 'knowledge-map__toolbar-group is-actions' });
		this.labeledButton(actions, 'globe-2', 'Open globe for this folder', 'Globe', () => {
			void this.plugin.activateGlobe(this.currentPath);
		});
		this.labeledButton(actions, 'layout-dashboard', 'Manage canvases', 'Canvases', () => this.openCanvasMenu());
		this.sliderControl(actions, 'Node size', 0.6, 1.8, 0.1, this.plugin.store.settings.nodeScale, (value) => {
			this.plugin.store.setSettings({ nodeScale: value });
			this.renderer?.setNodeScale(value);
		});
		this.sliderControl(actions, 'Link thickness', 0.5, 2, 0.1, this.plugin.store.settings.linkScale, (value) => {
			this.plugin.store.setSettings({ linkScale: value });
			this.renderer?.setLinkScale(value);
		});
		this.iconButton(actions, 'scan', 'Reset viewport', () => this.renderer?.resetViewport());
		this.iconButton(actions, 'rotate-ccw', 'Reset this folder layout', () => {
			this.plugin.store.resetMap(this.currentPath);
			this.renderMap();
		});
	}

	private openCanvasMenu(): void {
		new CanvasManagerModal(
			this.plugin,
			this.currentPath,
			this.lastGraph,
			this.lastPositions,
		).open();
	}

	private sliderControl(
		parent: HTMLElement,
		label: string,
		min: number,
		max: number,
		step: number,
		value: number,
		onChange: (value: number) => void,
	): void {
		const wrapper = parent.createEl('label', { cls: 'knowledge-map__slider', attr: { 'aria-label': label } });
		wrapper.createSpan({ text: label });
		const input = wrapper.createEl('input', { type: 'range' });
		input.min = `${min}`;
		input.max = `${max}`;
		input.step = `${step}`;
		input.value = `${value}`;
		input.addEventListener('input', () => onChange(Number(input.value)));
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, callback: () => void): HTMLButtonElement {
		const button = parent.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
		setIcon(button, icon);
		button.addEventListener('click', callback);
		return button;
	}

	private labeledButton(
		parent: HTMLElement,
		icon: string,
		label: string,
		text: string,
		callback: () => void,
	): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'knowledge-map__toolbar-action',
			attr: { 'aria-label': label },
		});
		setIcon(button, icon);
		button.createSpan({ text });
		button.addEventListener('click', callback);
		return button;
	}

	private renderMap(): void {
		if (!this.graphEl) return;
		this.ensureCurrentFolderExists();
		this.renderer?.destroy();
		this.graphEl.empty();
		this.renderBreadcrumbs();
		this.backButton.disabled = !this.history.canBack;
		this.forwardButton.disabled = !this.history.canForward;

		const settings = this.plugin.store.settings;
		const graph = this.graphBuilder.build(this.currentPath, settings.showExternalLinks);
		const state = this.plugin.store.getMapState(this.currentPath);
		const savedNodes = state?.nodes ?? {};
		const positions = createInitialPositions(graph, savedNodes);
		if (this.positionsChanged(savedNodes, positions)) {
			this.plugin.store.setNodePositions(this.currentPath, positions);
		}
		this.lastGraph = graph;
		this.lastPositions = positions;

		if (!graph.nodes.some((node) => node.kind === 'folder' || node.kind === 'note' || node.kind === 'external-note')) {
			this.graphEl.createDiv({
				cls: 'knowledge-map__empty',
				text: 'This folder has no child folders or Markdown notes yet.',
			});
		}

		this.renderer = new GraphRenderer({
			container: this.graphEl,
			graph,
			positions,
			viewport: state?.viewport ?? { x: 0, y: 0, zoom: 1 },
			showLabels: settings.showLabels,
			nodeScale: settings.nodeScale,
			linkScale: settings.linkScale,
			onNodeActivate: (node, event) => this.activateNode(node, event),
			onPositionChange: (id, position) => this.plugin.store.setNodePosition(this.currentPath, id, position),
			onViewportChange: (viewport) => this.plugin.store.setViewport(this.currentPath, viewport),
		});
		this.renderEdgeLegend(graph);
	}

	private renderEdgeLegend(graph: FolderGraph): void {
		const kinds = new Set(graph.edges.map((edge) => edge.kind));
		if (kinds.size === 0) return;
		const legend = this.graphEl.createDiv({ cls: 'knowledge-map__legend' });
		if (kinds.has('containment')) this.legendItem(legend, 'containment', 'Folder hierarchy');
		if (kinds.has('link')) this.legendItem(legend, 'link', 'Note reference');
	}

	private legendItem(parent: HTMLElement, kind: 'containment' | 'link', label: string): void {
		const item = parent.createDiv({ cls: 'knowledge-map__legend-item' });
		item.createSpan({ cls: `knowledge-map__legend-line is-${kind}` });
		item.createSpan({ text: label });
	}

	private ensureCurrentFolderExists(): void {
		while (this.currentPath !== ROOT_PATH && !this.app.vault.getFolderByPath(this.currentPath)) {
			this.currentPath = parentFolderPath(this.currentPath) ?? ROOT_PATH;
		}
	}

	private renderBreadcrumbs(): void {
		this.breadcrumbEl.empty();
		const rootButton = this.breadcrumbEl.createEl('button', { text: 'Vault' });
		rootButton.addEventListener('click', () => this.openFolder(ROOT_PATH));
		if (this.currentPath === ROOT_PATH) return;
		let path = '';
		for (const segment of this.currentPath.split('/')) {
			this.breadcrumbEl.createSpan({ cls: 'knowledge-map__breadcrumb-separator', text: '/' });
			path = path ? `${path}/${segment}` : segment;
			const segmentPath = path;
			const button = this.breadcrumbEl.createEl('button', { text: segment });
			button.addEventListener('click', () => this.openFolder(segmentPath));
		}
	}

	private activateNode(node: MapNode, event: MouseEvent): void {
		if (node.kind === 'folder') {
			this.openFolder(node.path);
			return;
		}
		if (node.kind === 'current-folder') return;
		const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
		void this.app.workspace.openLinkText(node.path, this.currentPath, newLeaf);
	}

	private positionsChanged(
		saved: Record<string, SavedNodePosition>,
		positions: ReturnType<typeof createInitialPositions>,
	): boolean {
		return Object.entries(positions).some(([id, position]) => {
			const existing = saved[id];
			return !existing
				|| existing.x !== position.x
				|| existing.y !== position.y
				|| existing.fixed !== position.fixed;
		});
	}
}
