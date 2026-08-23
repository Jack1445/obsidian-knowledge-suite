import type { Plugin } from 'obsidian';
import { normalizeFolderPath, remapPath } from '../core/paths';
import type { FolderMapState, SavedNodePosition, ViewportState } from '../core/graph';
import { migrateData } from './migrations';
import type {
	GlobePosition,
	KnowledgeCanvasState,
	KnowledgeMapData,
	KnowledgeMapSettings,
} from './schema';

export class KnowledgeMapStore {
	private data!: KnowledgeMapData;
	private saveTimer: number | null = null;

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

	registerKnowledgeCanvas(filePath: string, folderPath: string): void {
		const normalized = normalizeFolderPath(folderPath);
		this.data.knowledgeCanvases[filePath] = {
			folderPath: normalized,
			history: [normalized],
			historyIndex: 0,
			layouts: {},
		};
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
				folderPath: remapPath(state.folderPath, oldPath, newPath),
				history: state.history.map((path) => remapPath(path, oldPath, newPath)),
				historyIndex: state.historyIndex,
				layouts: {},
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
		for (const canvasPath of Object.keys(this.data.knowledgeCanvases)) {
			if (canvasPath === path || canvasPath.startsWith(`${path}/`)) {
				delete this.data.knowledgeCanvases[canvasPath];
			}
		}
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
}
