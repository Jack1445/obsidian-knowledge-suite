import { describe, expect, it } from 'vitest';
import { migrateData } from '../src/data/migrations';

describe('plugin data migrations', () => {
	it('adds per-folder layouts to existing knowledge canvases', () => {
		const migrated = migrateData({
			schemaVersion: 2,
			knowledgeCanvases: {
				'Canvas.excalidraw.md': {
					folderPath: 'Projects',
					history: ['/', 'Projects'],
					historyIndex: 1,
				},
			},
		});

		expect(migrated.schemaVersion).toBe(3);
		expect(migrated.knowledgeCanvases['Canvas.excalidraw.md']?.layouts).toEqual({});
	});
});
