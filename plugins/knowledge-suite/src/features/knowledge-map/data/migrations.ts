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
				{
					...state,
					canvasType: state.canvasType === '3d' ? '3d' : '2d',
					layouts: state.layouts ?? {},
				},
			]),
		),
		canvasReferences: candidate.canvasReferences ?? {},
		canvasOrder: candidate.canvasOrder ?? {},
		customNodeColors: (candidate.customNodeColors ?? [])
			.filter((color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
			.map((color) => color.toLowerCase())
			.filter((color, index, colors) => colors.indexOf(color) === index)
			.slice(0, 12),
	};
}
