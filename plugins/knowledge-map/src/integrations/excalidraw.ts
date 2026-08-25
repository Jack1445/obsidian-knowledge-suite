import {
	App,
	Menu,
	Notice,
	setIcon,
	TAbstractFile,
	TFile,
	TFolder,
	type WorkspaceLeaf,
} from 'obsidian';
import type { FolderGraph, MapEdge, MapNode, SavedNodePosition } from '../core/graph';
import { ROOT_PATH } from '../core/graph';
import { folderDisplayName, normalizeFolderPath } from '../core/paths';
import type { KnowledgeMapStore } from '../data/store';
import { VaultGraphBuilder } from '../obsidian/vault-graph-builder';
import { createInitialPositions } from '../services/initial-layout';
import { canvasDisplayName } from '../services/canvas-tree';
import { KnowledgeFormulaDialog, renderLatexToSvgDataUrl } from '../ui/formula-dialog';
import {
	KNOWLEDGE_CANVAS_DATA_KEY,
	canNavigateBackFromKnowledgeCanvas,
	findKnowledgeCanvasFolderNode,
	getKnowledgeCanvasContextTarget,
	getKnowledgeCanvasFolderActivation,
	parseKnowledgeCanvasLink,
	readKnowledgeCanvasData,
	resolveContextMenuElement,
	resolveCurrentViewFile,
	type KnowledgeCanvasAction,
	type KnowledgeCanvasElementData,
} from './knowledge-canvas-model';

const EXCALIDRAW_VIEW_TYPE = 'excalidraw';
const NODE_SCALE = 1.35;
const FOLDER_SIZE = 112;
const NOTE_SIZE = 84;
const TEXT_STYLE_DATA_KEY = 'knowledgeMapTextStyle';
const BOLD_OFFSET_X = 0.72;
const BOLD_OFFSET_Y = 0.18;

interface ExcalidrawElementLike {
	id: string;
	type?: string;
	text?: string;
	originalText?: string;
	rawText?: string;
	link?: string | null;
	strokeColor?: string;
	backgroundColor?: string;
	strokeWidth?: number;
	strokeStyle?: string;
	fillStyle?: string;
	roughness?: number;
	opacity?: number;
	fontSize?: number;
	fontFamily?: number;
	textAlign?: 'left' | 'center' | 'right';
	verticalAlign?: 'top' | 'middle' | 'bottom';
	lineHeight?: number;
	angle?: number;
	scale?: [number, number];
	containerId?: string | null;
	boundElements?: unknown[] | null;
	locked?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	isDeleted?: boolean;
	customData?: Record<string, unknown>;
}

interface KnowledgeTextStyleData {
	bold?: boolean;
	shadowId?: string;
	boldShadow?: boolean;
	sourceId?: string;
}

interface ExcalidrawViewLike {
	file?: TFile | null;
	containerEl?: HTMLElement;
	excalidrawAPI?: {
		getAppState(): {
			editingTextElement?: ExcalidrawElementLike | null;
			zoom?: { value: number };
			offsetLeft?: number;
			offsetTop?: number;
			scrollX?: number;
			scrollY?: number;
		};
		getElementAtPosition?(
			x: number,
			y: number,
			opts?: { preferSelected?: boolean; includeLockedElements?: boolean },
		): ExcalidrawElementLike | null;
		setViewport?(options: {
			target: ExcalidrawElementLike;
			fit: 'none';
			animation?: boolean | { duration?: number };
			offsets?: { ui?: true };
		}): void;
	};
	getViewType(): string;
}

interface ExcalidrawStyleLike {
	strokeColor: string;
	backgroundColor: string;
	strokeWidth: number;
	strokeStyle?: string;
	fillStyle?: string;
	roughness?: number;
	fontSize?: number;
}

interface ExcalidrawDropData {
	ea: ExcalidrawAutomateLike;
	event?: {
		dataTransfer?: {
			getData(type: string): string;
			types?: readonly string[];
		} | null;
		nativeEvent?: {
			dataTransfer?: {
				getData(type: string): string;
				types?: readonly string[];
			} | null;
		};
	};
	draggable: unknown;
	type: 'file' | 'text' | 'unknown';
	payload: { files: TFile[] | null; text: string | null };
	excalidrawFile: TFile;
	view: ExcalidrawViewLike;
	pointerPosition: { x: number; y: number };
}

interface ExcalidrawAutomateLike {
	reset(): void;
	addEllipse(x: number, y: number, width: number, height: number, id?: string): string;
	addRect?(x: number, y: number, width: number, height: number, id?: string): string;
	addText(
		x: number,
		y: number,
		text: string,
		formatting?: {
			width?: number;
			textAlign?: 'left' | 'center' | 'right';
			box?: boolean | 'ellipse';
			autoResize?: boolean;
		},
	): string;
	addArrow(
		points: [number, number][],
		formatting?: {
			startArrowHead?: 'arrow' | null;
			endArrowHead?: 'arrow' | null;
			startObjectId?: string;
			endObjectId?: string;
		},
	): string;
	addImage?(options: {
		topX: number;
		topY: number;
		imageFile: string;
		scale?: boolean;
		anchor?: boolean;
	}): Promise<string | null>;
	addToGroup?(ids: string[]): string;
	addAppendUpdateCustomData?(
		id: string,
		data: Record<string, unknown>,
	): ExcalidrawElementLike | undefined;
	getElement(id: string): ExcalidrawElementLike | undefined;
	getAPI?(view?: ExcalidrawViewLike): ExcalidrawAutomateLike;
	setView?(view?: ExcalidrawViewLike | 'active' | 'first'): ExcalidrawViewLike | undefined;
	getViewElements?(): ExcalidrawElementLike[];
	getViewSelectedElement?(): ExcalidrawElementLike | null;
	getViewCenterPosition?(): { x: number; y: number };
	getViewLastPointerPosition?(): { x: number; y: number };
	copyViewElementsToEAforEditing?(elements: ExcalidrawElementLike[], copyImages?: boolean): void;
	deleteViewElements?(elements: ExcalidrawElementLike[]): boolean;
	addElementsToView?(
		repositionToCursor?: boolean,
		save?: boolean,
		newElementsOnTop?: boolean,
		shouldRestoreElements?: boolean,
	): Promise<boolean>;
	selectElementsInView?(elements: ExcalidrawElementLike[] | string[]): void;
	registerThisAsViewEA?(): boolean;
	setFillStyle?(value: number): string;
	setStrokeStyle?(value: number): string;
	setStrokeSharpness?(value: number): string;
	style?: ExcalidrawStyleLike;
	targetView?: ExcalidrawViewLike;
	onLinkClickHook?: (
		element: ExcalidrawElementLike,
		linkText: string,
		event: MouseEvent,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	) => boolean;
	onDropHook?: (data: ExcalidrawDropData) => boolean;
	onSceneChangeHook?: {
		trackElements: true;
		callback: (elements: readonly ExcalidrawElementLike[]) => void;
	} | null;
	onViewUnloadHook?: (view: ExcalidrawViewLike) => void;
	isExcalidrawFile?(file: TFile): boolean;
	create(params?: {
		filename?: string;
		foldername?: string;
		onNewPane?: boolean;
		silent?: boolean;
		plaintext?: string;
		frontmatterKeys?: {
			'excalidraw-default-mode'?: 'view' | 'zen';
		};
	}): Promise<string>;
}

declare global {
	interface Window {
		ExcalidrawAutomate?: ExcalidrawAutomateLike;
	}
}

function drawingName(prefix: string): string {
	const timestamp = new Date().toISOString().replaceAll(':', '-').replace('T', ' ').slice(0, 19);
	return `${prefix} ${timestamp}`;
}

function elementData(
	scope: KnowledgeCanvasElementData['scope'],
	role: KnowledgeCanvasElementData['role'],
	patch: Partial<KnowledgeCanvasElementData> = {},
): Record<string, unknown> {
	const definedPatch = Object.fromEntries(
		Object.entries(patch).filter((entry) => entry[1] !== undefined),
	);
	return {
		[KNOWLEDGE_CANVAS_DATA_KEY]: {
			managed: true,
			scope,
			role,
			...definedPatch,
		},
	};
}

function readTextStyleData(element: ExcalidrawElementLike): KnowledgeTextStyleData | null {
	const value = element.customData?.[TEXT_STYLE_DATA_KEY];
	return value && typeof value === 'object' ? value : null;
}

function readFormulaLatex(element: ExcalidrawElementLike | null | undefined): string | null {
	const value = element?.customData?.latex;
	return element?.type === 'image' && typeof value === 'string' ? value : null;
}

export class ExcalidrawIntegration {
	private readonly graphBuilder: VaultGraphBuilder;
	private readonly boundViews = new WeakSet<object>();
	private readonly navigationLocks = new Set<string>();
	private readonly renderingViews = new WeakSet<object>();
	private readonly stylingViews = new WeakSet<object>();
	private readonly boldSyncTimers = new WeakMap<object, number>();

	constructor(
		private readonly app: App,
		private readonly store: KnowledgeMapStore,
	) {
		this.graphBuilder = new VaultGraphBuilder(app);
	}

	get available(): boolean {
		return Boolean(window.ExcalidrawAutomate);
	}

	isDrawing(file: TFile): boolean {
		return window.ExcalidrawAutomate?.isExcalidrawFile?.(file) ?? file.path.endsWith('.excalidraw.md');
	}

	isKnowledgeCanvas(file: TFile): boolean {
		return Boolean(this.store.getKnowledgeCanvas(file.path));
	}

	async createBlank(folderPath: string): Promise<void> {
		const ea = this.requireApi();
		if (!ea) return;
		ea.reset();
		await ea.create({
			filename: drawingName('空白画布'),
			foldername: folderPath === ROOT_PATH ? undefined : folderPath,
			onNewPane: true,
			plaintext: '由2维画布插件创建的普通 Excalidraw 画布。',
		});
	}

	async createKnowledgeCanvas(
		folderPath: string,
		parentCanvasPath?: string,
	): Promise<string | null> {
		const ea = this.requireApi();
		if (!ea) return null;
		const normalizedPath = normalizeFolderPath(folderPath);
		const graph = this.graphBuilder.build(normalizedPath, this.store.settings.showExternalLinks);
		const positions = createInitialPositions(graph, this.store.getMapState(normalizedPath)?.nodes ?? {});

		ea.reset();
		this.addFolderMapToWorkbench(ea, graph, positions, Boolean(parentCanvasPath));
		const filePath = await ea.create({
			filename: drawingName(`${folderDisplayName(normalizedPath)} 2维画布`),
			foldername: normalizedPath === ROOT_PATH ? undefined : normalizedPath,
			onNewPane: true,
			plaintext: [
				'由2维画布插件创建。',
				'文件夹节点会打开持久化的子画布。',
				'文件夹结构变化时会保留你自己添加的 Excalidraw 元素。',
			].join(' '),
		});
		this.store.registerKnowledgeCanvas(filePath, normalizedPath, parentCanvasPath);
		await this.store.flush();
		await this.bindCreatedCanvas(filePath);
		new Notice(parentCanvasPath ? '子画布已创建。' : '2维画布已创建。');
		return filePath;
	}

	async createFromGraph(
		folderPath: string,
		_graph: FolderGraph,
		_positions: Record<string, SavedNodePosition>,
	): Promise<void> {
		await this.createKnowledgeCanvas(folderPath);
	}

	bindOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE)) this.bindLeaf(leaf);
	}

	bindLeaf(leaf: WorkspaceLeaf | null): boolean {
		if (!leaf) return false;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		if (view.getViewType() !== EXCALIDRAW_VIEW_TYPE || !file || !this.isKnowledgeCanvas(file)) return false;
		if (this.boundViews.has(view)) return true;

		const rootApi = this.requireApi(false);
		const ea = rootApi?.getAPI?.(view);
		if (!ea) return false;
		ea.setView?.(view);
		ea.onLinkClickHook = (element, linkText, event, hookView, hookEa) => {
			const currentFile = resolveCurrentViewFile(file, hookView.file);
			if (!this.store.getKnowledgeCanvas(currentFile.path)) return true;
			const target = parseKnowledgeCanvasLink(linkText);
			if (target) {
				const data = readKnowledgeCanvasData(element);
				if (target.action === 'folder' && target.path && data) {
					void this.activateFolderElement(
						currentFile,
						hookView,
						hookEa,
						data,
						event.ctrlKey || event.metaKey,
					);
				} else {
					void this.activateKnowledgeTarget(currentFile, hookView, hookEa, target, false);
				}
				return false;
			}
			const data = readKnowledgeCanvasData(element);
			if (data?.canvasType && data.path) {
				void this.openManagedCanvasFile(currentFile, data.path, event.ctrlKey || event.metaKey);
				return false;
			}
			if (!data?.path || data.nodeKind !== 'note' && data.nodeKind !== 'external-note') return true;
			void this.openKnowledgeNote(currentFile, data.path, event.ctrlKey || event.metaKey);
			return false;
		};
		ea.onDropHook = (data) => {
			const dropped = this.collectDroppedItems(data);
			if (dropped.length === 0) return false;
			const currentFile = resolveCurrentViewFile(file, data.view.file);
			void this.addDroppedItems(currentFile, data.ea, dropped, data.pointerPosition);
			// Excalidraw 2.26.x treats true as "handled" here and skips its native text-link drop.
			return true;
		};
		let latestElements: readonly ExcalidrawElementLike[] = [];
		let positionSaveTimer: number | null = null;
		ea.onSceneChangeHook = {
			trackElements: true,
			callback: (elements) => {
				if (this.renderingViews.has(view) || this.stylingViews.has(view)) return;
				latestElements = elements;
				if (positionSaveTimer !== null) window.clearTimeout(positionSaveTimer);
				positionSaveTimer = window.setTimeout(() => {
					positionSaveTimer = null;
					const currentFile = resolveCurrentViewFile(file, view.file);
					this.persistCanvasPositions(currentFile, latestElements);
					this.syncCanvasReferencesFromElements(currentFile, latestElements);
				}, 150);
				this.scheduleBoldLayerSync(view, ea, latestElements);
			},
		};
		const removeDirectClick = this.registerDirectClick(file, view, ea);
		const removeShortcuts = this.registerCanvasShortcuts(file, view, ea);
		let removeResetMenuOption = (): void => undefined;
		let removeTextControls = (): void => undefined;
		ea.onViewUnloadHook = (unloadedView) => {
			if (unloadedView !== view) return;
			if (positionSaveTimer !== null) window.clearTimeout(positionSaveTimer);
			const boldTimer = this.boldSyncTimers.get(view);
			if (boldTimer !== undefined) window.clearTimeout(boldTimer);
			this.persistCanvasPositions(resolveCurrentViewFile(file, unloadedView.file), latestElements);
			removeDirectClick();
			removeShortcuts();
			removeResetMenuOption();
			removeTextControls();
			this.boundViews.delete(view);
			ea.onLinkClickHook = undefined;
			ea.onDropHook = undefined;
			ea.onSceneChangeHook = null;
		};
		ea.registerThisAsViewEA?.();
		// Excalidraw can report false after an Obsidian hot reload because the
		// previous plugin instance is still registered for this view. Menu options,
		// direct pointer handling and shortcuts do not depend on that registration,
		// so always attach them to the current view. Otherwise Insert formula and
		// Reset layout disappear until the entire Obsidian app is restarted.
		this.boundViews.add(view);
		removeResetMenuOption = this.registerResetMenuOption(file, view, ea);
		// Partial bold is now implemented by the maintained Excalidraw Core fork.
		// Do not inject the legacy whole-element B button because it duplicates
		// the native control and competes for the textarea selection.
		removeTextControls = (): void => undefined;
		void this.polishManagedElements(file, ea);
		return true;
	}

	async refreshActiveKnowledgeCanvas(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		const state = file ? this.store.getKnowledgeCanvas(file.path) : undefined;
		if (!file || !state) {
			new Notice('当前标签页不是2维画布。');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		await this.renderFolderIntoView(file, state.folderPath, view, ea, false);
		new Notice('2维画布已刷新。');
	}

	async goBackActiveKnowledgeCanvas(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		if (!file || !this.store.getKnowledgeCanvas(file.path)) {
			new Notice('当前标签页不是2维画布。');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
		const folderPath = this.store.goBackKnowledgeCanvas(file.path);
		if (folderPath) {
			await this.renderFolderIntoView(file, folderPath, view, ea, false, false, false);
			return;
		}
		await this.openParentKnowledgeCanvas(file);
	}

	async resetActiveKnowledgeCanvasLayout(): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		if (!leaf) return;
		const view = leaf.view as unknown as ExcalidrawViewLike;
		const file = view.file;
		const state = file ? this.store.getKnowledgeCanvas(file.path) : undefined;
		if (!file || !state) {
			new Notice('当前标签页不是2维画布。');
			return;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		if (!ea) return;
		await this.restoreDefaultLayout(file, view, ea);
	}

	async editFormulaInActiveKnowledgeCanvas(): Promise<void> {
		const context = this.getActiveKnowledgeCanvasContext();
		if (!context) return;
		const selected = context.ea.getViewSelectedElement?.() ?? null;
		await this.openFormulaEditor(
			context.file,
			context.view,
			context.ea,
			readFormulaLatex(selected) === null ? null : selected,
		);
	}

	async toggleBoldInActiveKnowledgeCanvas(): Promise<void> {
		const context = this.getActiveKnowledgeCanvasContext();
		if (!context) return;
		await this.toggleCurrentTextBold(context.view, context.ea);
	}

	private async followKnowledgeLink(
		file: TFile,
		action: KnowledgeCanvasAction,
		path: string | undefined,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		if (action === 'back') {
			this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
			const previous = this.store.goBackKnowledgeCanvas(file.path);
			if (previous) {
				await this.renderFolderIntoView(file, previous, view, ea, false, false, false);
				return;
			}
			await this.openParentKnowledgeCanvas(file);
			return;
		}
		if (action === 'reset') {
			await this.restoreDefaultLayout(file, view, ea);
			return;
		}
		const folderPath = action === 'root' ? ROOT_PATH : path;
		if (!folderPath) return;
		await this.renderFolderIntoView(file, folderPath, view, ea, true);
	}

	private registerDirectClick(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container || !ea.getViewSelectedElement) return () => undefined;
		let start: { x: number; y: number; time: number } | null = null;
		const onPointerDown = (event: PointerEvent): void => {
			if (event.button !== 0) return;
			start = { x: event.clientX, y: event.clientY, time: Date.now() };
		};
		const onPointerUp = (event: PointerEvent): void => {
			if (!start || event.button !== 0) return;
			const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
			const elapsed = Date.now() - start.time;
			start = null;
			if (distance > 5 || elapsed > 600) return;
			const openInNewLeaf = event.ctrlKey || event.metaKey;
			window.setTimeout(() => {
				const currentFile = resolveCurrentViewFile(file, view.file);
				if (!this.store.getKnowledgeCanvas(currentFile.path)) return;
				const element = ea.getViewSelectedElement?.();
				if (!element) return;
				const data = readKnowledgeCanvasData(element);
				if (!data) return;
				if (data.canvasType && data.path) {
					void this.openManagedCanvasFile(currentFile, data.path, openInNewLeaf);
					return;
				}
				if (data.action === 'folder' && data.path) {
					void this.activateFolderElement(
						currentFile,
						view,
						ea,
						data,
						openInNewLeaf,
					);
					return;
				}
				if (data.action === 'back' || data.action === 'reset' || data.action === 'root') {
					void this.activateKnowledgeTarget(currentFile, view, ea, { action: data.action }, false);
					return;
				}
				if (data.path && (data.nodeKind === 'note' || data.nodeKind === 'external-note')) {
					void this.openKnowledgeNote(currentFile, data.path, openInNewLeaf);
				}
			}, 0);
		};
		const onDoubleClick = (event: MouseEvent): void => {
			if (event.button !== 0) return;
			const element = ea.getViewSelectedElement?.();
			if (!element || readFormulaLatex(element) === null) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			void this.openFormulaEditor(resolveCurrentViewFile(file, view.file), view, ea, element);
		};
		const onContextMenu = (event: MouseEvent): void => {
			const hitElement = this.getContextMenuHitElement(view, event);
			const element = resolveContextMenuElement(
				hitElement,
				ea.getViewSelectedElement?.(),
			);
			const data = element ? readKnowledgeCanvasData(element) : null;
			const targetType = getKnowledgeCanvasContextTarget(data);
			if (targetType === 'native' || !data?.path) return;
			const targetFile = this.app.vault.getAbstractFileByPath(data.path);
			if (targetType === 'file' && !(targetFile instanceof TFile)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const currentFile = resolveCurrentViewFile(file, view.file);
			if (targetType === 'canvas') {
				this.showCanvasNodeMenu(currentFile, data.path, event);
			} else if (targetType === 'folder') {
				this.showFolderNodeMenu(currentFile, view, ea, data, event);
			} else if (targetFile instanceof TFile) {
				this.showFileNodeMenu(currentFile, targetFile, event);
			}
		};
		container.addEventListener('pointerdown', onPointerDown, true);
		container.addEventListener('pointerup', onPointerUp, true);
		container.addEventListener('dblclick', onDoubleClick, true);
		container.addEventListener('contextmenu', onContextMenu, true);
		return () => {
			container.removeEventListener('pointerdown', onPointerDown, true);
			container.removeEventListener('pointerup', onPointerUp, true);
			container.removeEventListener('dblclick', onDoubleClick, true);
			container.removeEventListener('contextmenu', onContextMenu, true);
		};
	}

	private registerResetMenuOption(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container) return () => undefined;
		const viewWindow = container.ownerDocument.defaultView ?? window;
		const document = container.ownerDocument;
		let disposed = false;
		let animationFrame: number | null = null;
		const insertIntoOpenMenu = (): void => {
			animationFrame = null;
			if (disposed) return;
			const containerRect = container.getBoundingClientRect();
			const visible = containerRect.width > 0
				&& containerRect.height > 0
				&& container.getClientRects().length > 0;
			if (!visible) return;

			const menus = Array.from(document.querySelectorAll<HTMLElement>('.excalidraw .dropdown-menu'))
				.filter((menu) => {
					const rect = menu.getBoundingClientRect();
					return rect.width > 120
						&& rect.height > 80
						&& rect.left >= containerRect.left
						&& rect.right <= containerRect.right
						&& rect.top >= containerRect.top
						&& rect.top < containerRect.top + 320;
				});
			for (const menu of menus) {
				const menuContainer = menu.querySelector<HTMLElement>('.dropdown-menu-container') ?? menu;
				if (menuContainer.querySelector('.knowledge-map-excalidraw-reset-menu')) continue;
				const group = menuContainer.createDiv({
					cls: 'knowledge-map-excalidraw-reset-menu',
				});
				const addItem = (
					label: string,
					iconName: string,
					onClick: () => void,
				): void => {
					const item = group.createEl('button', { cls: 'dropdown-menu-item' });
					item.type = 'button';
					item.setAttribute('aria-label', label);
					const text = item.createSpan({ cls: 'dropdown-menu-item__text' });
					const icon = text.createSpan({ cls: 'knowledge-map-excalidraw-reset-menu__icon' });
					setIcon(icon, iconName);
					text.createSpan({ text: label });
					item.addEventListener('pointerdown', (event) => event.stopPropagation());
					item.addEventListener('click', (event) => {
						event.preventDefault();
						event.stopPropagation();
						const MenuKeyboardEvent = menu.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
						(menu.ownerDocument.defaultView ?? window).dispatchEvent(new MenuKeyboardEvent(
							'keydown',
							{ key: 'Escape', code: 'Escape', bubbles: true, cancelable: true },
						));
						onClick();
					});
				};
				const selectedFormula = readFormulaLatex(ea.getViewSelectedElement?.()) !== null;
				addItem(
					selectedFormula ? '编辑公式' : '插入公式',
					'sigma',
					() => void this.openFormulaEditor(
						resolveCurrentViewFile(file, view.file),
						view,
						ea,
						selectedFormula ? ea.getViewSelectedElement?.() ?? null : null,
					),
				);
				addItem(
					'恢复知识布局',
					'rotate-ccw',
					() => void this.activateKnowledgeTarget(
						resolveCurrentViewFile(file, view.file),
						view,
						ea,
						{ action: 'reset' },
						false,
					),
				);
			}
		};
		const scheduleInsertion = (): void => {
			if (animationFrame !== null) return;
			animationFrame = viewWindow.requestAnimationFrame(insertIntoOpenMenu);
		};

		const Observer = container.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(scheduleInsertion);
		observer.observe(container, { childList: true, subtree: true });
		const interval = viewWindow.setInterval(scheduleInsertion, 250);
		scheduleInsertion();

		return () => {
			disposed = true;
			observer.disconnect();
			viewWindow.clearInterval(interval);
			if (animationFrame !== null) viewWindow.cancelAnimationFrame(animationFrame);
			document.querySelectorAll('.knowledge-map-excalidraw-reset-menu')
				.forEach((element) => element.remove());
		};
	}

	private registerCanvasShortcuts(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container) return () => undefined;
		const viewWindow = container.ownerDocument.defaultView ?? window;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (this.app.workspace.getLeaf(false)?.view !== view) return;
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			if (event.target instanceof Element && event.target.closest('.knowledge-map-formula-dialog')) return;
			const key = event.key.toLowerCase();
			if (key === 'm' && event.shiftKey) {
				event.preventDefault();
				event.stopImmediatePropagation();
				const selected = ea.getViewSelectedElement?.() ?? null;
				void this.openFormulaEditor(
					resolveCurrentViewFile(file, view.file),
					view,
					ea,
					readFormulaLatex(selected) === null ? null : selected,
				);
				return;
			}
			// Ctrl/Cmd+B belongs to the native Core text editor. The former
			// Knowledge Map capture handler stopped the event before the Core fork
			// could apply formatting to the selected character range.
		};
		// Keep only the Knowledge Map-specific formula shortcut here.
		viewWindow.addEventListener('keydown', onKeyDown, true);
		return () => viewWindow.removeEventListener('keydown', onKeyDown, true);
	}

	private registerTextStyleControls(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): () => void {
		const container = view.containerEl;
		if (!container) return () => undefined;
		const document = container.ownerDocument;
		const viewWindow = document.defaultView ?? window;
		let disposed = false;
		let animationFrame: number | null = null;

		const update = (): void => {
			animationFrame = null;
			if (disposed) return;
			const selected = this.resolvePrimaryTextElement(
				ea,
				ea.getViewSelectedElement?.()
					?? view.excalidrawAPI?.getAppState().editingTextElement
					?? null,
			);
			const existingButtons = container.querySelectorAll<HTMLElement>('.knowledge-map-excalidraw-bold-button');
			if (!selected) {
				existingButtons.forEach((element) => {
					const row = element.parentElement;
					element.remove();
					row?.removeClass('knowledge-map-excalidraw-font-row');
				});
				return;
			}
			const active = readTextStyleData(selected)?.bold === true;
			if (existingButtons.length > 0) {
				existingButtons.forEach((button) => {
					button.parentElement?.addClass('knowledge-map-excalidraw-font-row');
					button.toggleClass('is-active', active);
				});
				return;
			}
			const row = this.findFontControlRow(container);
			if (!row) return;
			row.addClass('knowledge-map-excalidraw-font-row');
			const button = row.createEl('button', { cls: 'ToolIcon ToolIcon_type_button' });
			button.type = 'button';
			button.addClass('knowledge-map-excalidraw-bold-button');
			button.toggleClass('is-active', active);
			button.setAttribute('aria-label', '粗体 — Ctrl+B');
			button.title = '粗体 — Ctrl+B';
			const icon = button.createDiv({ cls: 'ToolIcon__icon' });
			icon.createSpan({ text: 'B', cls: 'knowledge-map-excalidraw-bold-letter' });
			button.addEventListener('pointerdown', (event) => {
				event.preventDefault();
				event.stopPropagation();
			});
			button.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				void this.toggleCurrentTextBold(view, ea);
			});
		};
		const scheduleUpdate = (): void => {
			if (animationFrame !== null) return;
			animationFrame = viewWindow.requestAnimationFrame(update);
		};
		const Observer = document.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(scheduleUpdate);
		observer.observe(container, { childList: true, subtree: true });
		const interval = viewWindow.setInterval(scheduleUpdate, 250);
		scheduleUpdate();
		return () => {
			disposed = true;
			observer.disconnect();
			viewWindow.clearInterval(interval);
			if (animationFrame !== null) viewWindow.cancelAnimationFrame(animationFrame);
			container.querySelectorAll<HTMLElement>('.knowledge-map-excalidraw-bold-button')
				.forEach((element) => {
					const row = element.parentElement;
					element.remove();
					row?.removeClass('knowledge-map-excalidraw-font-row');
				});
		};
	}

	private findFontControlRow(container: HTMLElement): HTMLElement | null {
		const labels = Array.from(container.querySelectorAll<HTMLElement>('*')).filter((element) => {
			if (element.children.length > 0 || element.getClientRects().length === 0) return false;
			const text = element.textContent?.trim().toLocaleLowerCase();
			return text === '字体' || text === 'font family';
		});
		for (const label of labels) {
			let section: HTMLElement | null = label.parentElement;
			for (let depth = 0; section && depth < 5; depth += 1, section = section.parentElement) {
				const buttonList = section.querySelector<HTMLElement>('.buttonList');
				if (buttonList && buttonList.children.length >= 3 && buttonList.children.length <= 10) {
					return buttonList;
				}
				const candidates = [section, ...Array.from(section.querySelectorAll<HTMLElement>('div'))];
				for (const candidate of candidates) {
					const controls = Array.from(candidate.children)
						.filter((child) => child.tagName === 'BUTTON' || child.tagName === 'LABEL');
					if (controls.length >= 3 && controls.length <= 10) return candidate;
				}
			}
		}
		return null;
	}

	private async openFormulaEditor(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		element: ExcalidrawElementLike | null,
	): Promise<void> {
		if (!this.store.getKnowledgeCanvas(file.path)) return;
		const container = view.containerEl;
		if (!container || !ea.addImage || !ea.addElementsToView) {
			new Notice('当前 Excalidraw 版本未提供图像自动化接口。');
			return;
		}
		if (container.ownerDocument.querySelector('.knowledge-map-formula-dialog')) return;
		const rect = container.getBoundingClientRect();
		const initialLatex = readFormulaLatex(element) ?? '';
		const dialog = new KnowledgeFormulaDialog({
			document: container.ownerDocument,
			initialLatex,
			anchor: {
				left: rect.left + Math.max(12, (rect.width - 520) / 2),
				bottom: rect.top + 170,
			},
			onConfirm: async (latex) => {
				await this.insertOrUpdateFormula(view, ea, latex, element);
			},
		});
		dialog.open();
	}

	private async insertOrUpdateFormula(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		latex: string,
		existing: ExcalidrawElementLike | null,
	): Promise<void> {
		if (!ea.addImage || !ea.addElementsToView) return;
		const normalized = latex.trim();
		if (!normalized) {
			if (existing) {
				ea.deleteViewElements?.([existing]);
				new Notice('公式已移除。');
			}
			return;
		}
		this.stylingViews.add(view);
		try {
			ea.setView?.(view);
			ea.reset();
			const dataUrl = await renderLatexToSvgDataUrl(
				normalized,
				view.containerEl?.ownerDocument ?? document,
			);
			if (!dataUrl) {
				new Notice('无法渲染 LaTeX 公式。');
				return;
			}
			const id = await ea.addImage({
				topX: 0,
				topY: 0,
				imageFile: dataUrl,
				scale: false,
				anchor: false,
			});
			if (!id) {
				new Notice('无法渲染 LaTeX 公式。');
				return;
			}
			const formula = ea.getElement(id);
			if (!formula || formula.width === undefined || formula.height === undefined) {
				new Notice('找不到已渲染的公式元素。');
				return;
			}
			if (existing?.x !== undefined && existing.y !== undefined
				&& existing.width !== undefined && existing.height !== undefined) {
				const centerX = existing.x + existing.width / 2;
				const centerY = existing.y + existing.height / 2;
				const scale = existing.height / Math.max(1, formula.height);
				formula.width *= scale;
				formula.height *= scale;
				formula.x = centerX - formula.width / 2;
				formula.y = centerY - formula.height / 2;
			} else {
				const center = ea.getViewCenterPosition?.() ?? { x: 0, y: 0 };
				formula.x = center.x - formula.width / 2;
				formula.y = center.y - formula.height / 2;
			}
			this.tag(ea, id, {
				latex: normalized,
				...elementData('manual', 'formula', { latex: normalized }),
			});
			if (existing) ea.deleteViewElements?.([existing]);
			const added = await ea.addElementsToView(false, true, true);
			if (added === false) {
				new Notice('无法将公式添加到 Excalidraw。');
				return;
			}
			ea.selectElementsInView?.([id]);
			new Notice(existing
				? '公式已更新并选中。'
				: '公式已插入可见画布中央并选中。');
		} finally {
			this.stylingViews.delete(view);
		}
	}

	private resolvePrimaryTextElement(
		ea: ExcalidrawAutomateLike,
		element: ExcalidrawElementLike | null,
	): ExcalidrawElementLike | null {
		if (!element) return null;
		const styleData = readTextStyleData(element);
		let primary = element;
		if (styleData?.boldShadow && styleData.sourceId) {
			primary = ea.getViewElements?.().find((candidate) => candidate.id === styleData.sourceId) ?? element;
		}
		if (primary.type !== 'text' || primary.isDeleted) return null;
		if (readKnowledgeCanvasData(primary)?.scope === 'map') return null;
		return primary;
	}

	private async toggleCurrentTextBold(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		const editing = view.excalidrawAPI?.getAppState().editingTextElement ?? null;
		if (!editing) {
			await this.toggleSelectedTextBold(view, ea);
			return;
		}

		// Commit the textarea before creating/updating the visual weight layer;
		// otherwise Excalidraw can overwrite the change when text editing ends.
		const activeElement = view.containerEl?.ownerDocument.activeElement;
		if (activeElement instanceof HTMLElement) activeElement.blur();
		await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
		const latest = ea.getViewElements?.().find((element) => element.id === editing.id) ?? editing;
		await this.toggleSelectedTextBold(view, ea, latest);
	}

	private async toggleSelectedTextBold(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		target?: ExcalidrawElementLike | null,
	): Promise<void> {
		const primary = this.resolvePrimaryTextElement(
			ea,
			target ?? ea.getViewSelectedElement?.() ?? null,
		);
		if (!primary) {
			new Notice('请先在2维画布中选择一个文字元素。');
			return;
		}
		if (primary.containerId) {
			new Notice('粗体目前仅支持独立文字，不支持绑定在形状内的文字。');
			return;
		}
		if (!ea.copyViewElementsToEAforEditing || !ea.addElementsToView) return;
		const styleData = readTextStyleData(primary);
		this.stylingViews.add(view);
		try {
			if (styleData?.bold) {
				const shadow = ea.getViewElements?.().find((candidate) => candidate.id === styleData.shadowId);
				if (shadow) ea.deleteViewElements?.([shadow]);
				ea.reset();
				ea.copyViewElementsToEAforEditing([primary], false);
				const editable = ea.getElement(primary.id);
				if (!editable) return;
				editable.customData = {
					...(editable.customData ?? {}),
					[TEXT_STYLE_DATA_KEY]: { bold: false },
				};
				await ea.addElementsToView(false, true, false);
				ea.selectElementsInView?.([primary.id]);
				new Notice('已取消粗体。');
				return;
			}
			if (
				primary.x === undefined || primary.y === undefined
				|| primary.width === undefined || primary.height === undefined
			) return;
			ea.reset();
			ea.copyViewElementsToEAforEditing([primary], false);
			const editablePrimary = ea.getElement(primary.id);
			if (!editablePrimary) return;
			const shadowId = ea.addText(
				primary.x + BOLD_OFFSET_X,
				primary.y + BOLD_OFFSET_Y,
				primary.text ?? primary.originalText ?? '',
				{
					width: primary.width,
					textAlign: primary.textAlign ?? 'left',
					autoResize: false,
				},
			);
			const shadow = ea.getElement(shadowId);
			if (!shadow) return;
			this.copyBoldVisualProperties(primary, shadow);
			shadow.customData = {
				...(shadow.customData ?? {}),
				[TEXT_STYLE_DATA_KEY]: { boldShadow: true, sourceId: primary.id },
			};
			editablePrimary.customData = {
				...(editablePrimary.customData ?? {}),
				[TEXT_STYLE_DATA_KEY]: { bold: true, shadowId },
			};
			await ea.addElementsToView(false, true, false);
			ea.selectElementsInView?.([primary.id]);
			new Notice('已应用粗体。');
		} finally {
			this.stylingViews.delete(view);
		}
	}

	private copyBoldVisualProperties(
		primary: ExcalidrawElementLike,
		shadow: ExcalidrawElementLike,
	): void {
		for (const key of [
			'text', 'originalText', 'rawText', 'strokeColor', 'backgroundColor', 'fontSize',
			'fontFamily', 'textAlign', 'verticalAlign', 'lineHeight', 'angle', 'scale', 'opacity',
			'width', 'height',
		] as const) {
			const value = primary[key];
			if (value !== undefined) Object.assign(shadow, { [key]: value });
		}
		shadow.x = (primary.x ?? 0) + BOLD_OFFSET_X;
		shadow.y = (primary.y ?? 0) + BOLD_OFFSET_Y;
		shadow.link = null;
		shadow.containerId = null;
		shadow.boundElements = null;
		shadow.locked = true;
	}

	private scheduleBoldLayerSync(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		elements: readonly ExcalidrawElementLike[],
	): void {
		const current = this.boldSyncTimers.get(view);
		if (current !== undefined) window.clearTimeout(current);
		const timer = window.setTimeout(() => {
			this.boldSyncTimers.delete(view);
			void this.syncBoldLayers(view, ea, elements);
		}, 120);
		this.boldSyncTimers.set(view, timer);
	}

	private async syncBoldLayers(
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		elements: readonly ExcalidrawElementLike[],
	): Promise<void> {
		if (this.stylingViews.has(view) || !ea.copyViewElementsToEAforEditing || !ea.addElementsToView) return;
		const container = view.containerEl;
		const editingText = container
			? Array.from(container.querySelectorAll('textarea')).some((textarea) => {
				return textarea.getClientRects().length > 0
					&& !textarea.closest('.knowledge-map-formula-dialog');
			})
			: false;
		if (editingText) return;

		const byId = new Map(elements.filter((element) => !element.isDeleted).map((element) => [element.id, element]));
		const changes: ExcalidrawElementLike[] = [];
		const orphans: ExcalidrawElementLike[] = [];
		for (const element of byId.values()) {
			const data = readTextStyleData(element);
			if (data?.boldShadow && data.sourceId && !byId.has(data.sourceId)) orphans.push(element);
			if (!data?.bold || !data.shadowId) continue;
			const shadow = byId.get(data.shadowId);
			if (!shadow) continue;
			const expected = { ...shadow };
			this.copyBoldVisualProperties(element, expected);
			const keys: (keyof ExcalidrawElementLike)[] = [
				'text', 'originalText', 'rawText', 'strokeColor', 'backgroundColor', 'fontSize',
				'fontFamily', 'textAlign', 'verticalAlign', 'lineHeight', 'angle', 'scale', 'opacity',
				'width', 'height', 'x', 'y', 'locked',
			];
			if (keys.some((key) => JSON.stringify(shadow[key]) !== JSON.stringify(expected[key]))) {
				changes.push(element, shadow);
			}
		}
		if (orphans.length > 0) ea.deleteViewElements?.(orphans);
		if (changes.length === 0) return;
		const uniqueChanges = [...new Map(changes.map((element) => [element.id, element])).values()];
		this.stylingViews.add(view);
		try {
			ea.reset();
			ea.copyViewElementsToEAforEditing(uniqueChanges, false);
			for (const primary of uniqueChanges) {
				const data = readTextStyleData(primary);
				if (!data?.bold || !data.shadowId) continue;
				const editableShadow = ea.getElement(data.shadowId);
				if (editableShadow) this.copyBoldVisualProperties(primary, editableShadow);
			}
			await ea.addElementsToView(false, true, false);
		} finally {
			this.stylingViews.delete(view);
		}
	}

	private getActiveKnowledgeCanvasContext(): {
		file: TFile;
		view: ExcalidrawViewLike;
		ea: ExcalidrawAutomateLike;
	} | null {
		const leaf = this.app.workspace.getLeaf(false);
		const view = leaf?.view as unknown as ExcalidrawViewLike | undefined;
		const file = view?.file;
		if (!view || !file || !this.store.getKnowledgeCanvas(file.path)) {
			new Notice('当前标签页不是2维画布。');
			return null;
		}
		const ea = this.requireApi()?.getAPI?.(view);
		return ea ? { file, view, ea } : null;
	}

	private async restoreDefaultLayout(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		const state = this.store.getKnowledgeCanvas(file.path);
		if (!state) return;
		await this.renderFolderIntoView(file, state.folderPath, view, ea, false, true, false);
		new Notice('当前文件夹布局已恢复为默认位置。');
	}

	private async activateKnowledgeTarget(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		target: { action: KnowledgeCanvasAction; path?: string },
		_openInNewLeaf: boolean,
	): Promise<void> {
		const key = `canvas:${file.path}`;
		if (this.navigationLocks.has(key)) return;
		this.navigationLocks.add(key);
		try {
			await this.followKnowledgeLink(file, target.action, target.path, view, ea);
		} finally {
			window.setTimeout(() => this.navigationLocks.delete(key), 200);
		}
	}

	private getContextMenuHitElement(
		view: ExcalidrawViewLike,
		event: MouseEvent,
	): ExcalidrawElementLike | null | undefined {
		const api = view.excalidrawAPI;
		if (!api?.getElementAtPosition) return undefined;
		const state = api.getAppState();
		const zoom = state.zoom?.value;
		if (
			!zoom
			|| state.offsetLeft === undefined
			|| state.offsetTop === undefined
			|| state.scrollX === undefined
			|| state.scrollY === undefined
		) return undefined;
		const x = (event.clientX - state.offsetLeft) / zoom - state.scrollX;
		const y = (event.clientY - state.offsetTop) / zoom - state.scrollY;
		return api.getElementAtPosition(x, y, {
			preferSelected: false,
			includeLockedElements: true,
		});
	}

	private async activateFolderElement(
		file: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		data: KnowledgeCanvasElementData,
		openInNewLeaf: boolean,
	): Promise<void> {
		if (!data.path) return;
		if (getKnowledgeCanvasFolderActivation(data) === 'open-child-canvas') {
			const key = `child-canvas:${file.path}:${data.path}`;
			if (this.navigationLocks.has(key)) return;
			this.navigationLocks.add(key);
			try {
				this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
				await this.openOrCreateChildKnowledgeCanvas(file, data.path, openInNewLeaf);
			} finally {
				window.setTimeout(() => this.navigationLocks.delete(key), 200);
			}
			return;
		}
		await this.activateKnowledgeTarget(
			file,
			view,
			ea,
			{ action: 'folder', path: data.path },
			openInNewLeaf,
		);
	}

	private async openOrCreateChildKnowledgeCanvas(
		parentFile: TFile,
		folderPath: string,
		openInNewLeaf: boolean,
	): Promise<void> {
		const childPath = this.findFolderCanvasPath(parentFile.path, folderPath);
		if (childPath) {
			const childFile = this.app.vault.getAbstractFileByPath(childPath);
			if (childFile instanceof TFile) {
				this.store.addCanvasReference(parentFile.path, childFile.path);
				await this.openKnowledgeCanvasFile(childFile.path, parentFile.path, openInNewLeaf);
				return;
			}
			this.store.removeKnowledgeCanvas(childPath);
		}
		const createdPath = await this.createKnowledgeCanvas(folderPath, parentFile.path);
		if (createdPath) this.store.addCanvasReference(parentFile.path, createdPath);
	}

	private findFolderCanvasPath(sourceCanvasPath: string, folderPath: string): string | null {
		const normalizedFolderPath = normalizeFolderPath(folderPath);
		const childPath = this.store.findChildKnowledgeCanvas(
			sourceCanvasPath,
			normalizedFolderPath,
		);
		if (childPath) return childPath;
		return this.store.getOutgoingCanvasReferences(sourceCanvasPath).find((targetPath) => {
			const state = this.store.getKnowledgeCanvas(targetPath);
			return state?.canvasType === '2d' && state.folderPath === normalizedFolderPath;
		}) ?? null;
	}

	private async openParentKnowledgeCanvas(childFile: TFile): Promise<void> {
		const childState = this.store.getKnowledgeCanvas(childFile.path);
		const parentPath = childState?.parentCanvasPath;
		if (!parentPath) {
			new Notice('当前已经是顶层2维画布。');
			return;
		}
		const parentFile = this.app.vault.getAbstractFileByPath(parentPath);
		if (!(parentFile instanceof TFile)) {
			this.store.removeKnowledgeCanvas(parentPath);
			new Notice('找不到父画布。');
			return;
		}
		if (this.store.getKnowledgeCanvas(parentFile.path)?.canvasType === '3d') {
			const existingGlobeLeaf = this.app.workspace
				.getLeavesOfType('knowledge-map-globe-view')
				.find((leaf) => {
					return (leaf.view as unknown as { file?: TFile | null }).file?.path === parentFile.path;
				});
			if (existingGlobeLeaf) {
				await this.app.workspace.revealLeaf(existingGlobeLeaf);
				this.app.workspace.setActiveLeaf(existingGlobeLeaf, { focus: true });
			} else {
				await this.app.workspace.openLinkText(parentFile.path, childFile.path, false);
			}
			return;
		}
		const parentWasAlreadyOpen = await this.openKnowledgeCanvasFile(
			parentFile.path,
			childFile.path,
			false,
		);
		if (parentWasAlreadyOpen) return;
		const entryFolderPath = childState.history[0] ?? childState.folderPath;
		await this.centerKnowledgeCanvasFolderNode(parentFile.path, entryFolderPath);
	}

	async centerKnowledgeCanvasFolderNode(
		canvasPath: string,
		folderPath: string,
	): Promise<void> {
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const leaf = this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE).find((candidate) => {
				const view = candidate.view as unknown as ExcalidrawViewLike;
				return view.file?.path === canvasPath;
			});
			const view = leaf?.view as unknown as ExcalidrawViewLike | undefined;
			const ea = view ? this.requireApi(false)?.getAPI?.(view) : undefined;
			const element = ea?.getViewElements
				? findKnowledgeCanvasFolderNode(ea.getViewElements(), folderPath)
				: null;
			if (view && element && view.excalidrawAPI?.setViewport) {
				// Let Excalidraw finish its own open/reveal viewport restoration first.
				await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
				const latestElement = ea?.getViewElements
					? findKnowledgeCanvasFolderNode(ea.getViewElements(), folderPath)
					: null;
				if (!latestElement) return;
				view.excalidrawAPI.setViewport({
					target: latestElement,
					fit: 'none',
					animation: { duration: 220 },
					offsets: { ui: true },
				});
				return;
			}
			await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
		}
	}

	private async openKnowledgeCanvasFile(
		targetPath: string,
		sourcePath: string,
		openInNewLeaf: boolean,
	): Promise<boolean> {
		const existingLeaf = this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE).find((leaf) => {
			const candidate = leaf.view as unknown as ExcalidrawViewLike;
			return candidate.file?.path === targetPath;
		});
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			return true;
		}
		await this.app.workspace.openLinkText(targetPath, sourcePath, openInNewLeaf);
		return false;
	}

	private async openKnowledgeNote(sourceFile: TFile, notePath: string, newLeaf: boolean): Promise<void> {
		const key = `note:${sourceFile.path}:${notePath}`;
		if (this.navigationLocks.has(key)) return;
		this.navigationLocks.add(key);
		try {
			await this.app.workspace.openLinkText(notePath, sourceFile.path, newLeaf);
		} finally {
			window.setTimeout(() => this.navigationLocks.delete(key), 200);
		}
	}

	private async renderFolderIntoView(
		file: TFile,
		folderPath: string,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		addToHistory: boolean,
		resetLayout = false,
		captureCurrent = true,
	): Promise<void> {
		if (captureCurrent) this.persistCanvasPositions(file, ea.getViewElements?.() ?? []);
		const normalizedPath = normalizeFolderPath(folderPath);
		const abstractFile = this.resolvePath(normalizedPath);
		if (!(abstractFile instanceof TFolder)) {
			new Notice(`找不到文件夹：${normalizedPath}`);
			return;
		}
		this.renderingViews.add(view);
		try {
			if (resetLayout) this.store.resetKnowledgeCanvasLayout(file.path, normalizedPath);
			ea.setView?.(view);
			const generated = ea.getViewElements?.().filter((element) => {
				return readKnowledgeCanvasData(element)?.scope === 'map';
			}) ?? [];
			if (generated.length > 0) ea.deleteViewElements?.(generated);

			const graph = this.graphBuilder.build(normalizedPath, this.store.settings.showExternalLinks);
			const sharedPositions = resetLayout ? {} : this.store.getMapState(normalizedPath)?.nodes ?? {};
			const canvasPositions = resetLayout
				? {}
				: this.store.getKnowledgeCanvasPositions(file.path, normalizedPath);
			const positions = createInitialPositions(graph, { ...sharedPositions, ...canvasPositions });
			ea.reset();
			const state = this.store.getKnowledgeCanvas(file.path);
			this.addFolderMapToWorkbench(
				ea,
				graph,
				positions,
				state ? canNavigateBackFromKnowledgeCanvas(state) : false,
			);
			const added = await ea.addElementsToView?.(false, true, true);
			if (added === false) {
				new Notice('无法更新 Excalidraw 中的2维画布元素。');
				return;
			}
			this.store.openKnowledgeCanvasFolder(file.path, normalizedPath, addToHistory);
			await this.store.flush();
		} finally {
			this.renderingViews.delete(view);
		}
	}

	private persistCanvasPositions(
		file: TFile,
		elements: readonly ExcalidrawElementLike[],
	): void {
		const state = this.store.getKnowledgeCanvas(file.path);
		if (!state) return;
		const positions: Record<string, SavedNodePosition> = {};
		for (const element of elements) {
			const data = readKnowledgeCanvasData(element);
			if (
				data?.scope !== 'map'
				|| data.role !== 'node'
				|| !data.nodeKind
				|| !data.path
				|| element.isDeleted
				|| element.x === undefined
				|| element.y === undefined
				|| element.width === undefined
				|| element.height === undefined
			) continue;
			positions[`${data.nodeKind}:${data.path}`] = {
				x: (element.x + element.width / 2) / NODE_SCALE,
				y: (element.y + element.height / 2) / NODE_SCALE,
				fixed: true,
			};
		}
		if (Object.keys(positions).length > 0) {
			this.store.setKnowledgeCanvasPositions(file.path, state.folderPath, positions);
		}
	}

	private addFolderMapToWorkbench(
		ea: ExcalidrawAutomateLike,
		graph: FolderGraph,
		positions: Record<string, SavedNodePosition>,
		canGoBack: boolean,
	): void {
		this.addHeader(ea, graph.folderPath);
		this.addNavigation(ea, canGoBack);
		const elementIds = new Map<string, string>();

		for (const node of graph.nodes) {
			const point = positions[node.id];
			if (!point) continue;
			const nodeIds = this.addNode(ea, node, point.x * NODE_SCALE, point.y * NODE_SCALE, 'map');
			elementIds.set(node.id, nodeIds.shapeId);
		}

		for (const edge of graph.edges) {
			const from = positions[edge.from];
			const to = positions[edge.to];
			const fromId = elementIds.get(edge.from);
			const toId = elementIds.get(edge.to);
			if (!from || !to || !fromId || !toId) continue;
			this.addEdge(ea, edge, from, to, fromId, toId);
		}
	}

	private addHeader(ea: ExcalidrawAutomateLike, folderPath: string): void {
		this.setTextStyle(ea, '#3f3a34', 22);
		const breadcrumb = folderPath === ROOT_PATH ? '2维画布' : `2维画布  /  ${folderPath}`;
		const id = ea.addText(-360, -390, breadcrumb, { width: 720, textAlign: 'center' });
		this.tag(ea, id, elementData('map', 'header', { path: folderPath }));
	}

	private addNavigation(ea: ExcalidrawAutomateLike, canGoBack: boolean): void {
		if (!canGoBack) return;
		this.addNavigationChip(ea, -54, -330, 108, '返回', 'back');
	}

	private addNavigationChip(
		ea: ExcalidrawAutomateLike,
		x: number,
		y: number,
		width: number,
		label: string,
		action: KnowledgeCanvasAction,
	): void {
		this.setShapeStyle(ea, '#81766a', '#f5f0e8', 1.5, 0);
		const shapeId = ea.addRect?.(x, y, width, 42) ?? ea.addEllipse(x, y, width, 42);
		this.tag(ea, shapeId, elementData('map', 'navigation', { action }));
		this.setTextStyle(ea, '#514b44', 16);
		const textId = ea.addText(x, y + 11, label, { width, textAlign: 'center' });
		this.tag(ea, textId, elementData('map', 'navigation', { action }));
		ea.addToGroup?.([shapeId, textId]);
	}

	private addNode(
		ea: ExcalidrawAutomateLike,
		node: MapNode,
		centerX: number,
		centerY: number,
		scope: KnowledgeCanvasElementData['scope'],
	): { shapeId: string; textId: string } {
		const isFolder = node.kind === 'folder' || node.kind === 'current-folder';
		const size = isFolder ? FOLDER_SIZE : NOTE_SIZE;
		const x = centerX - size / 2;
		const y = centerY - size / 2;
		const isCurrent = node.kind === 'current-folder';
		this.setShapeStyle(
			ea,
			this.nodeStrokeColor(node.kind),
			this.nodeBackgroundColor(node.kind),
			isCurrent ? 2.4 : 2,
			0,
		);
		const shapeId = ea.addEllipse(x, y, size, size);
		const data = elementData(scope, 'node', {
			nodeKind: node.kind,
			path: node.path,
			action: node.kind === 'folder' ? 'folder' : undefined,
		});
		this.tag(ea, shapeId, data);

		this.setTextStyle(ea, this.nodeTextColor(node.kind), isFolder ? 17 : 15);
		const textId = ea.addText(x, y + size / 2 - 11, node.label, {
			width: size,
			textAlign: 'center',
			autoResize: false,
		});
		this.tag(ea, textId, elementData(scope, 'label', {
			nodeKind: node.kind,
			path: node.path,
			action: node.kind === 'folder' ? 'folder' : undefined,
		}));
		ea.addToGroup?.([shapeId, textId]);
		return { shapeId, textId };
	}

	private addEdge(
		ea: ExcalidrawAutomateLike,
		edge: MapEdge,
		from: SavedNodePosition,
		to: SavedNodePosition,
		fromId: string,
		toId: string,
	): void {
		const containment = edge.kind === 'containment';
		this.setShapeStyle(ea, containment ? '#c47a2c' : '#5b8fc9', 'transparent', containment ? 2.25 : 1.75, containment ? 0 : 1);
		const start: [number, number] = [from.x * NODE_SCALE, from.y * NODE_SCALE];
		const end: [number, number] = [to.x * NODE_SCALE, to.y * NODE_SCALE];
		const control = this.edgeControlPoint(edge, start, end);
		const edgeId = ea.addArrow([start, control, end], {
			startArrowHead: null,
			endArrowHead: containment ? 'arrow' : null,
			startObjectId: fromId,
			endObjectId: toId,
		});
		this.tag(ea, edgeId, elementData('map', 'edge', { edgeKind: edge.kind }));
	}

	private edgeControlPoint(
		edge: MapEdge,
		start: [number, number],
		end: [number, number],
	): [number, number] {
		const deltaX = end[0] - start[0];
		const deltaY = end[1] - start[1];
		const distance = Math.max(1, Math.hypot(deltaX, deltaY));
		const middleX = (start[0] + end[0]) / 2;
		const middleY = (start[1] + end[1]) / 2;
		const bend = Math.min(edge.kind === 'containment' ? 42 : 58, Math.max(18, distance * 0.1));
		let direction: number;
		if (edge.kind === 'containment' && Math.abs(deltaX) > 8) {
			// Fan hierarchy links gently away from the center instead of crossing each other.
			direction = deltaX < 0 ? 1 : -1;
		} else {
			let hash = 0;
			for (const character of edge.id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
			direction = (hash & 1) === 0 ? 1 : -1;
		}
		return [
			middleX - deltaY / distance * bend * direction,
			middleY + deltaX / distance * bend * direction,
		];
	}

	private collectDroppedItems(data: ExcalidrawDropData): TAbstractFile[] {
		const items = new Map<string, TAbstractFile>();
		for (const file of data.payload.files ?? []) this.addDropCandidate(items, file);
		this.addNestedDropCandidates(items, data.draggable, 0, new WeakSet<object>());
		this.addDropText(items, data.payload.text, data.excalidrawFile.path);

		const transfer = data.event?.dataTransfer ?? data.event?.nativeEvent?.dataTransfer;
		if (transfer) {
			const types = new Set<string>([
				'text/plain',
				'text/uri-list',
				'application/json',
				...(transfer.types ?? []),
			]);
			for (const type of types) {
				let value = '';
				try {
					value = transfer.getData(type);
				} catch {
					continue;
				}
				this.addDropText(items, value, data.excalidrawFile.path);
			}
		}
		return [...items.values()];
	}

	private addNestedDropCandidates(
		items: Map<string, TAbstractFile>,
		candidate: unknown,
		depth: number,
		seen: WeakSet<object>,
	): void {
		if (depth > 4 || candidate === null || candidate === undefined) return;
		this.addDropCandidate(items, candidate);
		if (typeof candidate !== 'object') return;
		if (seen.has(candidate)) return;
		seen.add(candidate);
		if (Array.isArray(candidate)) {
			for (const child of candidate) this.addNestedDropCandidates(items, child, depth + 1, seen);
			return;
		}
		const record = candidate as Record<string, unknown>;
		for (const key of ['file', 'files', 'folder', 'folders', 'item', 'items', 'path', 'paths', 'sourcePath']) {
			this.addNestedDropCandidates(items, record[key], depth + 1, seen);
		}
	}

	private addDropText(
		items: Map<string, TAbstractFile>,
		rawText: string | null | undefined,
		sourcePath: string,
	): void {
		const text = rawText?.trim() ?? '';
		if (!text) return;
		try {
			const parsed = JSON.parse(text) as unknown;
			this.addNestedDropCandidates(items, parsed, 0, new WeakSet<object>());
		} catch {
			// Most Obsidian drag payloads are links or paths rather than JSON.
		}

		for (const match of text.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g)) {
			this.addDropLinkText(items, match[1] ?? '', sourcePath);
		}
		for (const match of text.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
			this.addDropLinkText(items, match[1] ?? '', sourcePath);
		}
		for (const line of text.split(/\r?\n/)) this.addDropLinkText(items, line, sourcePath);
	}

	private addDropLinkText(
		items: Map<string, TAbstractFile>,
		candidateText: string,
		sourcePath: string,
	): void {
		let candidate = candidateText.trim().replace(/^<|>$/g, '');
		if (!candidate) return;
		try {
			if (candidate.startsWith('obsidian://')) {
				const url = new URL(candidate);
				candidate = url.searchParams.get('file') ?? url.searchParams.get('path') ?? '';
			}
			candidate = decodeURIComponent(candidate);
		} catch {
			// Keep the original value when it is not a URL-encoded path.
		}
		candidate = candidate
			.replace(/^file:\/\//, '')
			.replace(/^\[\[|]]$/g, '')
			.replace(/^\/+|\/+$/g, '')
			.trim();
		if (!candidate) return;

		const direct = this.resolvePath(candidate);
		if (direct) {
			this.addDropCandidate(items, direct);
			return;
		}
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
		if (linkedFile) {
			this.addDropCandidate(items, linkedFile);
			return;
		}
		const folderMatches = this.app.vault.getAllLoadedFiles().filter((file) => {
			return file instanceof TFolder && (file.name === candidate || file.path.endsWith(`/${candidate}`));
		});
		if (folderMatches.length === 1) this.addDropCandidate(items, folderMatches[0]);
	}

	private addDropCandidate(items: Map<string, TAbstractFile>, candidate: unknown): void {
		let abstractFile: TAbstractFile | null = null;
		if (candidate instanceof TAbstractFile) abstractFile = candidate;
		else if (typeof candidate === 'string') abstractFile = this.resolvePath(candidate);
		else if (candidate && typeof candidate === 'object' && 'path' in candidate) {
			const path = (candidate as { path?: unknown }).path;
			if (typeof path === 'string') abstractFile = this.resolvePath(path);
		}
		if (
			abstractFile instanceof TFolder
			|| abstractFile instanceof TFile && (
				abstractFile.extension === 'md'
				|| this.store.getKnowledgeCanvas(abstractFile.path)?.canvasType === '3d'
			)
		) {
			items.set(abstractFile.path, abstractFile);
		}
	}

	private async addDroppedItems(
		parentFile: TFile,
		ea: ExcalidrawAutomateLike,
		items: TAbstractFile[],
		pointer: { x: number; y: number },
	): Promise<void> {
		const existingCanvasTargets = new Set(
			(ea.getViewElements?.() ?? []).flatMap((element): string[] => {
				const data = readKnowledgeCanvasData(element);
				return data?.canvasType && data.path ? [data.path] : [];
			}),
		);
		ea.reset();
		const canvasPaths: string[] = [];
		let createdElementGroups = 0;
		let attemptedSelfDrop = false;
		items.forEach((item, index) => {
			const canvasState = item instanceof TFile ? this.store.getKnowledgeCanvas(item.path) : undefined;
			const column = index % 4;
			const row = Math.floor(index / 4);
			const centerX = pointer.x + column * 160;
			const centerY = pointer.y + row * 160;
			if (canvasState && item instanceof TFile) {
				if (item.path === parentFile.path) {
					attemptedSelfDrop = true;
					return;
				}
				if (!existingCanvasTargets.has(item.path)) {
					this.addManagedCanvasNode(ea, item, canvasState.canvasType, centerX, centerY);
					createdElementGroups += 1;
				}
				canvasPaths.push(item.path);
				return;
			}
			const isFolder = item instanceof TFolder;
			const label = item instanceof TFile ? item.basename : item.name;
			const node: MapNode = {
				id: `${isFolder ? 'folder' : 'note'}:${item.path}`,
				kind: isFolder ? 'folder' : 'note',
				path: item.path,
				label,
			};
			this.addNode(ea, node, centerX, centerY, 'manual');
			createdElementGroups += 1;
		});
		const added = createdElementGroups > 0
			? await ea.addElementsToView?.(false, true, true)
			: true;
		if (added === false) new Notice('无法将拖入的仓库项目添加到 Excalidraw。');
		else {
			for (const childPath of canvasPaths) {
				if (!this.store.addCanvasReference(parentFile.path, childPath)) {
					new Notice('无法建立画布引用关系。');
				}
			}
		}
		if (attemptedSelfDrop) new Notice('不能把画布拖入它自己。');
	}

	private syncCanvasReferencesFromElements(
		sourceFile: TFile,
		elements: readonly ExcalidrawElementLike[],
	): void {
		const visibleTargets = new Set(elements.flatMap((element): string[] => {
			if (element.isDeleted) return [];
			const data = readKnowledgeCanvasData(element);
			if (data?.canvasType && data.path) return [data.path];
			if (data?.nodeKind === 'folder' && data.path) {
				const folderCanvasPath = this.findFolderCanvasPath(sourceFile.path, data.path);
				return folderCanvasPath ? [folderCanvasPath] : [];
			}
			return [];
		}));
		for (const targetPath of visibleTargets) {
			this.store.addCanvasReference(sourceFile.path, targetPath);
		}
		for (const targetPath of this.store.getOutgoingCanvasReferences(sourceFile.path)) {
			if (!visibleTargets.has(targetPath)) {
				this.store.removeCanvasReference(sourceFile.path, targetPath);
			}
		}
	}

	private addManagedCanvasNode(
		ea: ExcalidrawAutomateLike,
		file: TFile,
		canvasType: '2d' | '3d',
		centerX: number,
		centerY: number,
	): void {
		const size = 92;
		const x = centerX - size / 2;
		const y = centerY - size / 2;
		const data = elementData('manual', 'node', { canvasType, path: file.path });
		const ids: string[] = [];
		const stroke = canvasType === '3d' ? '#4b8fc9' : '#7860a8';
		const background = canvasType === '3d' ? '#e8f4ff' : '#f1edfb';
		const textColor = canvasType === '3d' ? '#244b68' : '#43345f';
		this.setShapeStyle(ea, stroke, background, 2.2, 0);
		const bodyId = ea.addEllipse(x, y, size, size);
		this.tag(ea, bodyId, data);
		ids.push(bodyId);

		this.setShapeStyle(ea, stroke, 'transparent', 1.6, 0);
		const iconIds = canvasType === '3d'
			? [
				ea.addEllipse(x + 27, y + 11, 38, 70),
				ea.addEllipse(x + 11, y + 30, 70, 32),
			]
			: [
				ea.addEllipse(x + 39, y + 17, 14, 14),
				ea.addEllipse(x + 20, y + 59, 14, 14),
				ea.addEllipse(x + 58, y + 59, 14, 14),
				ea.addArrow([[centerX, y + 31], [x + 27, y + 59]], { startArrowHead: null, endArrowHead: null }),
				ea.addArrow([[centerX, y + 31], [x + 65, y + 59]], { startArrowHead: null, endArrowHead: null }),
			];
		for (const id of iconIds) {
			this.tag(ea, id, data);
			ids.push(id);
		}

		this.setTextStyle(ea, textColor, 15);
		const textId = ea.addText(centerX - 90, y + size + 10, canvasDisplayName(file.path), {
			width: 180,
			textAlign: 'center',
			autoResize: false,
		});
		this.tag(ea, textId, elementData('manual', 'label', { canvasType, path: file.path }));
		ids.push(textId);
		ea.addToGroup?.(ids);
	}

	private async openManagedCanvasFile(
		sourceFile: TFile,
		targetPath: string,
		openInNewLeaf: boolean,
	): Promise<void> {
		const target = this.app.vault.getAbstractFileByPath(targetPath);
		const targetState = target instanceof TFile ? this.store.getKnowledgeCanvas(target.path) : undefined;
		if (!(target instanceof TFile) || !targetState) {
			new Notice('找不到对应的画布。');
			return;
		}
		const viewType = targetState.canvasType === '3d' ? 'knowledge-map-globe-view' : EXCALIDRAW_VIEW_TYPE;
		const existing = this.app.workspace.getLeavesOfType(viewType).find((leaf) => {
			return (leaf.view as unknown as { file?: TFile | null }).file?.path === target.path;
		});
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			this.app.workspace.setActiveLeaf(existing, { focus: true });
			return;
		}
		await this.app.workspace.openLinkText(target.path, sourceFile.path, openInNewLeaf);
	}

	private showCanvasNodeMenu(sourceFile: TFile, targetPath: string, event: MouseEvent): void {
		const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
		const targetState = targetFile instanceof TFile
			? this.store.getKnowledgeCanvas(targetFile.path)
			: undefined;
		if (!(targetFile instanceof TFile) || !targetState) return;
		const isChild = this.store.getParentKnowledgeCanvasPath(targetPath) === sourceFile.path;
		const menu = this.createManagedNodeMenu(event);
		this.addManagedNodeMenuHeader(
			menu,
			`${targetState.canvasType === '3d' ? '3维画布' : '2维画布'} · ${canvasDisplayName(targetPath)}`,
			targetState.canvasType === '3d' ? 'globe-2' : 'network',
			'canvas',
		);
		menu.addItem((item) => item
			.setTitle('打开画布')
			.setIcon('panel-top-open')
			.setSection('knowledge-map-open')
			.onClick(() => void this.openManagedCanvasFile(sourceFile, targetPath, false)));
		menu.addItem((item) => item
			.setTitle('在新标签页中打开')
			.setIcon('external-link')
			.setSection('knowledge-map-open')
			.onClick(() => void this.openManagedCanvasFile(sourceFile, targetPath, true)));
		menu.addItem((item) => item
			.setTitle(isChild ? '取消设为子画布' : '设为子画布')
			.setIcon(isChild ? 'unlink' : 'git-branch-plus')
			.setSection('knowledge-map-relationship')
			.onClick(() => {
				if (!this.store.addCanvasReference(sourceFile.path, targetPath)) {
					new Notice('无法保留画布引用关系。');
					return;
				}
				const changed = isChild
					? this.store.clearParentKnowledgeCanvas(targetPath, sourceFile.path)
					: this.store.setParentKnowledgeCanvas(targetPath, sourceFile.path);
				new Notice(changed
					? isChild ? '已取消子画布关系，引用关系仍然保留。' : '已设为当前画布的子画布。'
					: '无法修改画布父子关系。');
			}));
		menu.showAtMouseEvent(event);
	}

	private showFolderNodeMenu(
		sourceFile: TFile,
		view: ExcalidrawViewLike,
		ea: ExcalidrawAutomateLike,
		data: KnowledgeCanvasElementData,
		event: MouseEvent,
	): void {
		if (!data.path) return;
		if (data.nodeKind === 'current-folder') {
			this.showCurrentFolderNodeMenu(data.path, event);
			return;
		}
		const targetPath = this.findFolderCanvasPath(sourceFile.path, data.path);
		const isChild = Boolean(
			targetPath
			&& this.store.getParentKnowledgeCanvasPath(targetPath) === sourceFile.path,
		);
		const menu = this.createManagedNodeMenu(event);
		this.addManagedNodeMenuHeader(
			menu,
			`文件夹画布 · ${folderDisplayName(data.path)}`,
			'folder-tree',
			'folder',
		);
		menu.addItem((item) => item
			.setTitle('打开文件夹画布')
			.setIcon('folder-open')
			.setSection('knowledge-map-open')
			.onClick(() => void this.activateFolderElement(sourceFile, view, ea, data, false)));
		menu.addItem((item) => item
			.setTitle('在新标签页中打开')
			.setIcon('external-link')
			.setSection('knowledge-map-open')
			.onClick(() => void this.activateFolderElement(sourceFile, view, ea, data, true)));
		menu.addItem((item) => item
			.setTitle(isChild ? '取消设为子画布' : '设为子画布')
			.setIcon(isChild ? 'unlink' : 'git-branch-plus')
			.setSection('knowledge-map-relationship')
			.onClick(() => void this.setFolderChildRelationship(sourceFile, data.path!, targetPath, isChild)));
		menu.showAtMouseEvent(event);
	}

	private showCurrentFolderNodeMenu(folderPath: string, event: MouseEvent): void {
		const folder = this.resolvePath(folderPath);
		const menu = this.createManagedNodeMenu(event);
		this.addManagedNodeMenuHeader(
			menu,
			`当前文件夹 · ${folderDisplayName(folderPath)}`,
			'folder-check',
			'folder',
		);
		menu.addItem((item) => item
			.setTitle('当前画布对应此文件夹')
			.setIcon('folder-check')
			.setSection('knowledge-map-relationship')
			.setDisabled(true));
		if (folder instanceof TFolder) {
			menu.addItem((item) => item
				.setTitle('在文件列表中定位')
				.setIcon('folder-search')
				.setSection('knowledge-map-info')
				.onClick(() => void this.revealInFileNavigation(folder)));
		}
		menu.addItem((item) => item
			.setTitle('复制文件夹路径')
			.setIcon('copy')
			.setSection('knowledge-map-info')
			.onClick(() => void this.copyVaultPath(folderPath)));
		menu.showAtMouseEvent(event);
	}

	private async setFolderChildRelationship(
		sourceFile: TFile,
		folderPath: string,
		existingTargetPath: string | null,
		isChild: boolean,
	): Promise<void> {
		if (isChild && existingTargetPath) {
			this.store.addCanvasReference(sourceFile.path, existingTargetPath);
			const changed = this.store.clearParentKnowledgeCanvas(existingTargetPath, sourceFile.path);
			new Notice(changed
				? '已取消子画布关系，引用关系仍然保留。'
				: '无法修改画布父子关系。');
			return;
		}
		let targetPath = existingTargetPath;
		if (!targetPath) {
			targetPath = await this.createKnowledgeCanvas(folderPath, sourceFile.path);
			if (!targetPath) return;
		}
		if (!this.store.addCanvasReference(sourceFile.path, targetPath)) {
			new Notice('无法保留画布引用关系。');
			return;
		}
		const changed = this.store.setParentKnowledgeCanvas(targetPath, sourceFile.path);
		new Notice(changed ? '已设为当前画布的子画布。' : '无法修改画布父子关系。');
	}

	private showFileNodeMenu(sourceFile: TFile, targetFile: TFile, event: MouseEvent): void {
		const menu = this.createManagedNodeMenu(event);
		this.addManagedNodeMenuHeader(
			menu,
			`文件 · ${targetFile.basename}`,
			'file-text',
			'file',
		);
		menu.addItem((item) => item
			.setTitle('打开文件')
			.setIcon('panel-top-open')
			.setSection('knowledge-map-open')
			.onClick(() => void this.openKnowledgeNote(sourceFile, targetFile.path, false)));
		menu.addItem((item) => item
			.setTitle('在新标签页中打开')
			.setIcon('external-link')
			.setSection('knowledge-map-open')
			.onClick(() => void this.openKnowledgeNote(sourceFile, targetFile.path, true)));
		menu.addItem((item) => item
			.setTitle('在文件列表中定位')
			.setIcon('folder-search')
			.setSection('knowledge-map-info')
			.onClick(() => void this.revealInFileNavigation(targetFile)));
		menu.addItem((item) => item
			.setTitle('复制路径')
			.setIcon('copy')
			.setSection('knowledge-map-info')
			.onClick(() => void this.copyVaultPath(targetFile.path)));
		this.app.workspace.trigger('file-menu', menu, targetFile, 'knowledge-canvas');
		menu.showAtMouseEvent(event);
	}

	private createManagedNodeMenu(event: MouseEvent): Menu {
		return Menu.forEvent(event).setUseNativeMenu(false);
	}

	private addManagedNodeMenuHeader(
		menu: Menu,
		title: string,
		icon: string,
		kind: 'canvas' | 'file' | 'folder',
	): void {
		menu.addItem((item) => item
			.setTitle(title)
			.setIcon(icon)
			.setIsLabel(true)
			.setSection(`knowledge-map-header-${kind}`));
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

	private async polishManagedElements(
		file: TFile,
		ea: ExcalidrawAutomateLike,
	): Promise<void> {
		if (!ea.getViewElements || !ea.copyViewElementsToEAforEditing || !ea.addElementsToView) return;
		const allElements = ea.getViewElements();
		const state = this.store.getKnowledgeCanvas(file.path);
		const canGoBack = state ? canNavigateBackFromKnowledgeCanvas(state) : false;
		const obsoleteNavigationElements = allElements.filter((element) => {
			const data = readKnowledgeCanvasData(element);
			return data?.role === 'navigation' && (
				data.action === 'reset'
				|| data.action === 'root'
				|| data.action === 'back' && !canGoBack
			);
		});
		if (obsoleteNavigationElements.length > 0) {
			ea.deleteViewElements?.(obsoleteNavigationElements);
		}
		const obsoleteIds = new Set(obsoleteNavigationElements.map((element) => element.id));
		const managedElements = allElements.filter((element) => {
			const data = readKnowledgeCanvasData(element);
			return Boolean(data) && !obsoleteIds.has(element.id);
		});
		if (managedElements.length === 0) return;
		ea.reset();
		ea.copyViewElementsToEAforEditing(managedElements, false);
		for (const element of managedElements) {
			const editable = ea.getElement(element.id);
			const data = readKnowledgeCanvasData(element);
			if (!editable || !data) continue;
			editable.link = null;
			if (data.role === 'node' && data.nodeKind) {
				Object.assign(editable, {
					strokeColor: this.nodeStrokeColor(data.nodeKind),
					backgroundColor: this.nodeBackgroundColor(data.nodeKind),
					strokeWidth: data.nodeKind === 'current-folder' ? 2.4 : 2,
					strokeStyle: 'solid',
					fillStyle: 'solid',
					roughness: 0,
					opacity: 100,
				});
			} else if (data.role === 'label' && data.nodeKind) {
				Object.assign(editable, {
					strokeColor: this.nodeTextColor(data.nodeKind),
					backgroundColor: 'transparent',
					roughness: 0,
					opacity: 100,
				});
			}
		}
		await ea.addElementsToView(false, true, false);
	}

	private nodeStrokeColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder': return '#9a6b35';
			case 'folder': return '#c77d2f';
			case 'external-note': return '#8274a6';
			case 'note': return '#5c82aa';
		}
	}

	private nodeBackgroundColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder': return '#f5ead8';
			case 'folder': return '#fff3d8';
			case 'external-note': return '#f2eef8';
			case 'note': return '#edf5fc';
		}
	}

	private nodeTextColor(kind: MapNode['kind']): string {
		switch (kind) {
			case 'current-folder':
			case 'folder': return '#4d4032';
			case 'external-note': return '#4e465f';
			case 'note': return '#34485c';
		}
	}

	private setShapeStyle(
		ea: ExcalidrawAutomateLike,
		strokeColor: string,
		backgroundColor: string,
		strokeWidth: number,
		strokeStyle: number,
	): void {
		if (!ea.style) return;
		Object.assign(ea.style, { strokeColor, backgroundColor, strokeWidth, roughness: 0, opacity: 100 });
		ea.setFillStyle?.(2);
		ea.setStrokeStyle?.(strokeStyle);
		ea.setStrokeSharpness?.(0);
	}

	private setTextStyle(ea: ExcalidrawAutomateLike, color: string, fontSize: number): void {
		if (!ea.style) return;
		Object.assign(ea.style, { strokeColor: color, backgroundColor: 'transparent', fontSize });
	}

	private tag(ea: ExcalidrawAutomateLike, id: string, data: Record<string, unknown>): void {
		if (ea.addAppendUpdateCustomData) {
			ea.addAppendUpdateCustomData(id, data);
			return;
		}
		const element = ea.getElement(id);
		if (element) element.customData = { ...(element.customData ?? {}), ...data };
	}

	private resolvePath(path: string): TAbstractFile | null {
		const normalized = normalizeFolderPath(path);
		return normalized === ROOT_PATH
			? this.app.vault.getRoot()
			: this.app.vault.getAbstractFileByPath(normalized);
	}

	private async bindCreatedCanvas(filePath: string): Promise<void> {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const leaf = this.app.workspace.getLeavesOfType(EXCALIDRAW_VIEW_TYPE).find((candidate) => {
				const view = candidate.view as unknown as ExcalidrawViewLike;
				return view.file?.path === filePath;
			});
			if (leaf && this.bindLeaf(leaf)) return;
			await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
		}
	}

	private requireApi(showNotice = true): ExcalidrawAutomateLike | null {
		const api = window.ExcalidrawAutomate;
		if (api) return api;
		if (showNotice) new Notice('请安装并启用 Excalidraw 插件以使用自由画布。');
		return null;
	}
}
