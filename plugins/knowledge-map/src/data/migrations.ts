import { CURRENT_SCHEMA_VERSION, createDefaultData, type KnowledgeMapData } from './schema';

export function migrateData(raw: unknown): KnowledgeMapData {
	const defaults = createDefaultData();
	if (!raw || typeof raw !== 'object') return defaults;

	const candidate = raw as Partial<KnowledgeMapData>;
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		settings: { ...defaults.settings, ...(candidate.settings ?? {}) },
		mapStates: candidate.mapStates ?? {},
		globePositions: candidate.globePositions ?? {},
		knowledgeCanvases: Object.fromEntries(
			Object.entries(candidate.knowledgeCanvases ?? {}).map(([filePath, state]) => [
				filePath,
				{ ...state, layouts: state.layouts ?? {} },
			]),
		),
	};
}
