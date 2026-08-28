import type { FolderMapState, SavedNodePosition } from '../core/graph';

export const CURRENT_SCHEMA_VERSION = 8;

export type KnowledgeCanvasType = '2d' | '3d';

export interface GlobePosition {
	lat: number;
	lng: number;
}

export interface KnowledgeCanvasState {
	canvasType: KnowledgeCanvasType;
	folderPath: string;
	history: string[];
	historyIndex: number;
	layouts: Record<string, Record<string, SavedNodePosition>>;
	parentCanvasPath?: string;
}

export interface KnowledgeMapSettings {
	showExternalLinks: boolean;
	showLabels: boolean;
	nodeScale: number;
	linkScale: number;
}

export interface KnowledgeMapData {
	schemaVersion: number;
	settings: KnowledgeMapSettings;
	mapStates: Record<string, FolderMapState>;
	globePositions: Record<string, Record<string, GlobePosition>>;
	knowledgeCanvases: Record<string, KnowledgeCanvasState>;
	canvasReferences: Record<string, string[]>;
	canvasOrder: Record<string, string[]>;
	customNodeColors: string[];
}

export const DEFAULT_SETTINGS: KnowledgeMapSettings = {
	showExternalLinks: false,
	showLabels: true,
	nodeScale: 1,
	linkScale: 1,
};

export function createDefaultData(): KnowledgeMapData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		settings: { ...DEFAULT_SETTINGS },
		mapStates: {},
		globePositions: {},
		knowledgeCanvases: {},
		canvasReferences: {},
		canvasOrder: {},
		customNodeColors: [],
	};
}
