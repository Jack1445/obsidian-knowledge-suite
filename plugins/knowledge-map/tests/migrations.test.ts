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

		expect(migrated.schemaVersion).toBe(7);
		expect(migrated.knowledgeCanvases['Canvas.excalidraw.md']?.layouts).toEqual({});
		expect(migrated.knowledgeCanvases['Canvas.excalidraw.md']?.canvasType).toBe('2d');
		expect(migrated.canvasReferences).toEqual({});
		expect(migrated.canvasOrder).toEqual({});
	});

	it('preserves persisted parent canvas relationships', () => {
		const migrated = migrateData({
			schemaVersion: 3,
			knowledgeCanvases: {
				'Child.excalidraw.md': {
					folderPath: 'Projects/Child',
					history: ['Projects/Child'],
					historyIndex: 0,
					layouts: {},
					parentCanvasPath: 'Parent.excalidraw.md',
				},
			},
		});

		expect(migrated.knowledgeCanvases['Child.excalidraw.md']?.parentCanvasPath)
			.toBe('Parent.excalidraw.md');
	});
});
