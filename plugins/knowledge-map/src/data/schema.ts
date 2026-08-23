import type { FolderMapState, SavedNodePosition } from '../core/graph';

export const CURRENT_SCHEMA_VERSION = 3;

export interface GlobePosition {
	lat: number;
	lng: number;
}

export interface KnowledgeCanvasState {
	folderPath: string;
	history: string[];
	historyIndex: number;
	layouts: Record<string, Record<string, SavedNodePosition>>;
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
	};
}
