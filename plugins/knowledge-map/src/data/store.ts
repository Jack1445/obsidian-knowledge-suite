import type { Plugin } from 'obsidian';
import { normalizeFolderPath, remapPath } from '../core/paths';
import type { FolderMapState, SavedNodePosition, ViewportState } from '../core/graph';
import { migrateData } from './migrations';
import type {
	GlobePosition,
	KnowledgeCanvasState,
	KnowledgeCanvasType,
	KnowledgeMapData,
	KnowledgeMapSettings,
} from './schema';

const ROOT_CANVAS_ORDER_KEY = '/';

export class KnowledgeMapStore {
	private data!: KnowledgeMapData;
	private saveTimer: number | null = null;
	private readonly knowledgeCanvasListeners = new Set<() => void>();

	constructor(private readonly plugin: Plugin) {}

	async load(): Promise<void> {
		this.data = migrateData(await this.plugin.loadData());
	}

	get settings(): KnowledgeMapSettings {
		return this.data.settings;
	}

	getMapState(folderPath: string): FolderMapState | undefined {
		return this.data.mapStates[normalizeFolderPath(folderPath)];
	}

	getGlobePositions(folderPath: string): Record<string, GlobePosition> {
		return this.data.globePositions[normalizeFolderPath(folderPath)] ?? {};
	}

	getKnowledgeCanvas(filePath: string): KnowledgeCanvasState | undefined {
		return this.data.knowledgeCanvases[filePath];
	}

	getKnowledgeCanvasEntries(): [string, KnowledgeCanvasState][] {
		return Object.entries(this.data.knowledgeCanvases);
	}

	getCanvasOrders(): Record<string, string[]> {
		return Object.fromEntries(
			Object.entries(this.data.canvasOrder).map(([key, paths]) => [key, [...paths]]),
		);
	}

	getCustomNodeColors(): string[] {
		return [...this.data.customNodeColors];
	}

	addCustomNodeColor(color: string): void {
		const normalized = color.toLowerCase();
		if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
		this.data.customNodeColors = [
			normalized,
			...this.data.customNodeColors.filter((existing) => existing !== normalized),
		].slice(0, 12);
		this.queueSave();
	}

	removeCustomNodeColor(color: string): void {
		const normalized = color.toLowerCase();
		const next = this.data.customNodeColors.filter((existing) => existing !== normalized);
		if (next.length === this.data.customNodeColors.length) return;
		this.data.customNodeColors = next;
		this.queueSave();
	}

	setCanvasOrder(parentCanvasPath: string | undefined, orderedPaths: readonly string[]): void {
		const key = this.canvasOrderKey(parentCanvasPath);
		const siblings = this.getSiblingCanvasPaths(parentCanvasPath);
		const siblingSet = new Set(siblings);
		const next: string[] = [];
		for (const filePath of orderedPaths) {
			if (siblingSet.delete(filePath)) next.push(filePath);
		}
		for (const filePath of siblings) {
			if (siblingSet.delete(filePath)) next.push(filePath);
		}
		if (next.length === 0) delete this.data.canvasOrder[key];
		else this.data.canvasOrder[key] = next;
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	getOutgoingCanvasReferences(sourceCanvasPath: string): string[] {
		return [...(this.data.canvasReferences[sourceCanvasPath] ?? [])];
	}

	getIncomingCanvasReferences(targetCanvasPath: string): string[] {
		return Object.entries(this.data.canvasReferences).flatMap(([sourcePath, targets]) => {
			return targets.includes(targetCanvasPath) ? [sourcePath] : [];
		});
	}

	addCanvasReference(sourceCanvasPath: string, targetCanvasPath: string): boolean {
		if (
			sourceCanvasPath === targetCanvasPath
			|| !this.data.knowledgeCanvases[sourceCanvasPath]
			|| !this.data.knowledgeCanvases[targetCanvasPath]
		) return false;
		const targets = this.data.canvasReferences[sourceCanvasPath] ??= [];
		if (targets.includes(targetCanvasPath)) return true;
		targets.push(targetCanvasPath);
		targets.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
		return true;
	}

	removeCanvasReference(sourceCanvasPath: string, targetCanvasPath: string): void {
		const targets = this.data.canvasReferences[sourceCanvasPath];
		if (!targets) return;
		const next = targets.filter((path) => path !== targetCanvasPath);
		if (next.length === targets.length) return;
		if (next.length > 0) this.data.canvasReferences[sourceCanvasPath] = next;
		else delete this.data.canvasReferences[sourceCanvasPath];
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	subscribeKnowledgeCanvases(listener: () => void): () => void {
		this.knowledgeCanvasListeners.add(listener);
		return () => this.knowledgeCanvasListeners.delete(listener);
	}

	registerKnowledgeCanvas(
		filePath: string,
		folderPath: string,
		parentCanvasPath?: string,
		canvasType: KnowledgeCanvasType = '2d',
	): void {
		const previousParent = this.data.knowledgeCanvases[filePath]?.parentCanvasPath;
		const isNewCanvas = !this.data.knowledgeCanvases[filePath];
		const normalized = normalizeFolderPath(folderPath);
		this.data.knowledgeCanvases[filePath] = {
			canvasType,
			folderPath: normalized,
			history: [normalized],
			historyIndex: 0,
			layouts: {},
			...(parentCanvasPath ? { parentCanvasPath } : {}),
		};
		if (isNewCanvas || previousParent !== parentCanvasPath) {
			this.moveCanvasOrder(filePath, parentCanvasPath);
		}
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	findChildKnowledgeCanvas(
		parentCanvasPath: string,
		folderPath: string,
		canvasType: KnowledgeCanvasType = '2d',
	): string | null {
		const normalized = normalizeFolderPath(folderPath);
		for (const [filePath, state] of Object.entries(this.data.knowledgeCanvases)) {
			if (
				state.parentCanvasPath === parentCanvasPath
				&& state.folderPath === normalized
				&& state.canvasType === canvasType
			) {
				return filePath;
			}
		}
		return null;
	}

	getParentKnowledgeCanvasPath(filePath: string): string | null {
		return this.data.knowledgeCanvases[filePath]?.parentCanvasPath ?? null;
	}

	setParentKnowledgeCanvas(childCanvasPath: string, parentCanvasPath: string): boolean {
		const child = this.data.knowledgeCanvases[childCanvasPath];
		const parent = this.data.knowledgeCanvases[parentCanvasPath];
		if (!child || !parent || childCanvasPath === parentCanvasPath) {
			return false;
		}
		let cursor: string | undefined = parentCanvasPath;
		const visited = new Set<string>();
		while (cursor) {
			if (cursor === childCanvasPath) {
				// The requested parent currently lives inside the dragged canvas's subtree.
				// Detach it first, then place the former ancestor underneath it. This turns
				// A -> B into B -> A instead of silently rejecting the user's drag.
				delete parent.parentCanvasPath;
				this.moveCanvasOrder(parentCanvasPath, undefined);
				break;
			}
			if (visited.has(cursor)) return false;
			visited.add(cursor);
			cursor = this.data.knowledgeCanvases[cursor]?.parentCanvasPath;
		}
		if (child.parentCanvasPath === parentCanvasPath) return true;
		child.parentCanvasPath = parentCanvasPath;
		this.moveCanvasOrder(childCanvasPath, parentCanvasPath);
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
		return true;
	}

	clearParentKnowledgeCanvas(childCanvasPath: string, expectedParentCanvasPath?: string): boolean {
		const child = this.data.knowledgeCanvases[childCanvasPath];
		if (
			!child?.parentCanvasPath
			|| expectedParentCanvasPath && child.parentCanvasPath !== expectedParentCanvasPath
		) return false;
		delete child.parentCanvasPath;
		this.moveCanvasOrder(childCanvasPath, undefined);
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
		return true;
	}

	removeKnowledgeCanvas(filePath: string): void {
		if (!this.data.knowledgeCanvases[filePath]) return;
		const children = this.getOrderedSiblingCanvasPaths(filePath);
		delete this.data.knowledgeCanvases[filePath];
		this.removeCanvasFromOrders(filePath);
		delete this.data.canvasOrder[this.canvasOrderKey(filePath)];
		for (const childPath of children) {
			const state = this.data.knowledgeCanvases[childPath];
			if (state?.parentCanvasPath !== filePath) continue;
			delete state.parentCanvasPath;
			this.moveCanvasOrder(childPath, undefined);
		}
		this.removeCanvasReferencesForPath(filePath);
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	getKnowledgeCanvasPositions(
		filePath: string,
		folderPath: string,
	): Record<string, SavedNodePosition> {
		return this.data.knowledgeCanvases[filePath]?.layouts[normalizeFolderPath(folderPath)] ?? {};
	}

	setKnowledgeCanvasPositions(
		filePath: string,
		folderPath: string,
		positions: Record<string, SavedNodePosition>,
	): void {
		const state = this.data.knowledgeCanvases[filePath];
		if (!state) return;
		const key = normalizeFolderPath(folderPath);
		state.layouts[key] = { ...(state.layouts[key] ?? {}), ...positions };
		this.queueSave();
	}

	resetKnowledgeCanvasLayout(filePath: string, folderPath: string): void {
		const state = this.data.knowledgeCanvases[filePath];
		if (!state) return;
		delete state.layouts[normalizeFolderPath(folderPath)];
		this.queueSave();
	}

	openKnowledgeCanvasFolder(filePath: string, folderPath: string, addToHistory = true): void {
		const normalized = normalizeFolderPath(folderPath);
		const state = this.data.knowledgeCanvases[filePath];
		if (!state) return;
		state.folderPath = normalized;
		if (addToHistory) {
			state.history = state.history.slice(0, state.historyIndex + 1);
			if (state.history[state.history.length - 1] !== normalized) state.history.push(normalized);
			state.historyIndex = state.history.length - 1;
		}
		this.queueSave();
	}

	goBackKnowledgeCanvas(filePath: string): string | null {
		const state = this.data.knowledgeCanvases[filePath];
		if (!state || state.historyIndex <= 0) return null;
		state.historyIndex -= 1;
		state.folderPath = state.history[state.historyIndex] ?? '/';
		this.queueSave();
		return state.folderPath;
	}

	setGlobePosition(folderPath: string, nodeId: string, position: GlobePosition): void {
		const key = normalizeFolderPath(folderPath);
		this.data.globePositions[key] ??= {};
		this.data.globePositions[key][nodeId] = position;
		this.queueSave();
	}

	setNodePosition(folderPath: string, nodeId: string, position: SavedNodePosition): void {
		const state = this.ensureMapState(folderPath);
		state.nodes[nodeId] = position;
		this.queueSave();
	}

	setNodePositions(folderPath: string, positions: Record<string, SavedNodePosition>): void {
		const state = this.ensureMapState(folderPath);
		Object.assign(state.nodes, positions);
		this.queueSave();
	}

	setViewport(folderPath: string, viewport: ViewportState): void {
		this.ensureMapState(folderPath).viewport = viewport;
		this.queueSave();
	}

	resetMap(folderPath: string): void {
		delete this.data.mapStates[normalizeFolderPath(folderPath)];
		this.queueSave();
	}

	async updateSettings(patch: Partial<KnowledgeMapSettings>): Promise<void> {
		Object.assign(this.data.settings, patch);
		await this.flush();
	}

	setSettings(patch: Partial<KnowledgeMapSettings>): void {
		Object.assign(this.data.settings, patch);
		this.queueSave();
	}

	migratePath(oldPath: string, newPath: string): void {
		const entries = Object.entries(this.data.mapStates);
		for (const [mapPath, state] of entries) {
			const mappedPath = remapPath(mapPath, oldPath, newPath);
			const mappedNodes: Record<string, SavedNodePosition> = {};
			for (const [id, position] of Object.entries(state.nodes)) {
				const separator = id.indexOf(':');
				const kind = separator < 0 ? '' : id.slice(0, separator + 1);
				const nodePath = separator < 0 ? id : id.slice(separator + 1);
				mappedNodes[`${kind}${remapPath(nodePath, oldPath, newPath)}`] = position;
			}
			if (mappedPath !== mapPath) delete this.data.mapStates[mapPath];
			this.data.mapStates[mappedPath] = { ...state, nodes: mappedNodes };
		}
		for (const [mapPath, positions] of Object.entries(this.data.globePositions)) {
			const mappedPath = remapPath(mapPath, oldPath, newPath);
			const mappedPositions: Record<string, GlobePosition> = {};
			for (const [id, position] of Object.entries(positions)) {
				const separator = id.indexOf(':');
				const kind = separator < 0 ? '' : id.slice(0, separator + 1);
				const nodePath = separator < 0 ? id : id.slice(separator + 1);
				mappedPositions[`${kind}${remapPath(nodePath, oldPath, newPath)}`] = position;
			}
			if (mappedPath !== mapPath) delete this.data.globePositions[mapPath];
			this.data.globePositions[mappedPath] = mappedPositions;
		}
		for (const [canvasPath, state] of Object.entries(this.data.knowledgeCanvases)) {
			const mappedCanvasPath = remapPath(canvasPath, oldPath, newPath);
			const mappedState: KnowledgeCanvasState = {
				canvasType: state.canvasType,
				folderPath: remapPath(state.folderPath, oldPath, newPath),
				history: state.history.map((path) => remapPath(path, oldPath, newPath)),
				historyIndex: state.historyIndex,
				layouts: {},
				...(state.parentCanvasPath
					? { parentCanvasPath: remapPath(state.parentCanvasPath, oldPath, newPath) }
					: {}),
			};
			for (const [layoutPath, positions] of Object.entries(state.layouts)) {
				const mappedLayoutPath = remapPath(layoutPath, oldPath, newPath);
				const mappedPositions: Record<string, SavedNodePosition> = {};
				for (const [id, position] of Object.entries(positions)) {
					const separator = id.indexOf(':');
					const kind = separator < 0 ? '' : id.slice(0, separator + 1);
					const nodePath = separator < 0 ? id : id.slice(separator + 1);
					mappedPositions[`${kind}${remapPath(nodePath, oldPath, newPath)}`] = position;
				}
				mappedState.layouts[mappedLayoutPath] = mappedPositions;
			}
			if (mappedCanvasPath !== canvasPath) delete this.data.knowledgeCanvases[canvasPath];
			this.data.knowledgeCanvases[mappedCanvasPath] = mappedState;
		}
		const mappedReferences: Record<string, string[]> = {};
		for (const [sourcePath, targetPaths] of Object.entries(this.data.canvasReferences)) {
			const mappedSource = remapPath(sourcePath, oldPath, newPath);
			mappedReferences[mappedSource] = [...new Set([
				...(mappedReferences[mappedSource] ?? []),
				...targetPaths.map((targetPath) => remapPath(targetPath, oldPath, newPath)),
			])];
		}
		this.data.canvasReferences = mappedReferences;
		const mappedOrder: Record<string, string[]> = {};
		for (const [parentKey, orderedPaths] of Object.entries(this.data.canvasOrder)) {
			const mappedParent = parentKey === ROOT_CANVAS_ORDER_KEY
				? ROOT_CANVAS_ORDER_KEY
				: remapPath(parentKey, oldPath, newPath);
			mappedOrder[mappedParent] = [...new Set([
				...(mappedOrder[mappedParent] ?? []),
				...orderedPaths.map((filePath) => remapPath(filePath, oldPath, newPath)),
			])];
		}
		this.data.canvasOrder = mappedOrder;
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	removePath(path: string): void {
		for (const [mapPath, state] of Object.entries(this.data.mapStates)) {
			if (mapPath === path || mapPath.startsWith(`${path}/`)) {
				delete this.data.mapStates[mapPath];
				continue;
			}
			for (const id of Object.keys(state.nodes)) {
				if (id.endsWith(`:${path}`) || id.includes(`:${path}/`)) delete state.nodes[id];
			}
		}
		for (const [mapPath, positions] of Object.entries(this.data.globePositions)) {
			if (mapPath === path || mapPath.startsWith(`${path}/`)) {
				delete this.data.globePositions[mapPath];
				continue;
			}
			for (const id of Object.keys(positions)) {
				if (id.endsWith(`:${path}`) || id.includes(`:${path}/`)) delete positions[id];
			}
		}
		const removedCanvasPaths: string[] = [];
		for (const canvasPath of Object.keys(this.data.knowledgeCanvases)) {
			if (canvasPath === path || canvasPath.startsWith(`${path}/`)) {
				delete this.data.knowledgeCanvases[canvasPath];
				removedCanvasPaths.push(canvasPath);
			}
		}
		const detachedChildren: string[] = [];
		for (const [canvasPath, state] of Object.entries(this.data.knowledgeCanvases)) {
			if (
				state.parentCanvasPath === path
				|| state.parentCanvasPath?.startsWith(`${path}/`)
			) {
				delete state.parentCanvasPath;
				detachedChildren.push(canvasPath);
			}
		}
		for (const canvasPath of removedCanvasPaths) {
			this.removeCanvasFromOrders(canvasPath);
			delete this.data.canvasOrder[this.canvasOrderKey(canvasPath)];
		}
		for (const childPath of detachedChildren) this.moveCanvasOrder(childPath, undefined);
		for (const canvasPath of removedCanvasPaths) this.removeCanvasReferencesForPath(canvasPath);
		this.notifyKnowledgeCanvasListeners();
		this.queueSave();
	}

	async flush(): Promise<void> {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		await this.plugin.saveData(this.data);
	}

	private ensureMapState(folderPath: string): FolderMapState {
		const key = normalizeFolderPath(folderPath);
		this.data.mapStates[key] ??= {
			viewport: { x: 0, y: 0, zoom: 1 },
			nodes: {},
		};
		return this.data.mapStates[key];
	}

	private queueSave(): void {
		if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.plugin.saveData(this.data);
		}, 250);
	}

	private notifyKnowledgeCanvasListeners(): void {
		for (const listener of this.knowledgeCanvasListeners) listener();
	}

	private removeCanvasReferencesForPath(filePath: string): void {
		delete this.data.canvasReferences[filePath];
		for (const [sourcePath, targets] of Object.entries(this.data.canvasReferences)) {
			const next = targets.filter((targetPath) => targetPath !== filePath);
			if (next.length > 0) this.data.canvasReferences[sourcePath] = next;
			else delete this.data.canvasReferences[sourcePath];
		}
	}

	private canvasOrderKey(parentCanvasPath: string | undefined): string {
		return parentCanvasPath ?? ROOT_CANVAS_ORDER_KEY;
	}

	private getSiblingCanvasPaths(parentCanvasPath: string | undefined): string[] {
		return Object.entries(this.data.knowledgeCanvases)
			.filter(([, state]) => state.parentCanvasPath === parentCanvasPath)
			.map(([filePath]) => filePath)
			.sort((left, right) => left.localeCompare(right, undefined, {
				numeric: true,
				sensitivity: 'base',
			}));
	}

	private getOrderedSiblingCanvasPaths(parentCanvasPath: string | undefined): string[] {
		const siblings = this.getSiblingCanvasPaths(parentCanvasPath);
		const siblingSet = new Set(siblings);
		const ordered = (this.data.canvasOrder[this.canvasOrderKey(parentCanvasPath)] ?? [])
			.filter((filePath) => siblingSet.delete(filePath));
		return [...ordered, ...siblings.filter((filePath) => siblingSet.has(filePath))];
	}

	private moveCanvasOrder(filePath: string, parentCanvasPath: string | undefined): void {
		this.removeCanvasFromOrders(filePath);
		const key = this.canvasOrderKey(parentCanvasPath);
		const siblings = this.getOrderedSiblingCanvasPaths(parentCanvasPath)
			.filter((path) => path !== filePath);
		this.data.canvasOrder[key] = [...siblings, filePath];
	}

	private removeCanvasFromOrders(filePath: string): void {
		for (const [key, paths] of Object.entries(this.data.canvasOrder)) {
			const next = paths.filter((path) => path !== filePath);
			if (next.length > 0) this.data.canvasOrder[key] = next;
			else delete this.data.canvasOrder[key];
		}
	}
}
