import { describe, expect, it } from 'vitest';
import type { App, Plugin } from 'obsidian';
import { KnowledgeSuiteDataCoordinator } from '../../src/core/KnowledgeSuiteDataCoordinator';

describe('Knowledge Suite data coordination', () => {
	it('backs up and imports legacy data once without changing source files', async () => {
		const files = new Map<string, string>([
			['.obsidian/plugins/obsidian-excalidraw-plugin/data.json', '{"theme":"dark"}'],
			['.obsidian/plugins/knowledge-map/data.json', '{"schemaVersion":8,"mapStates":{}}'],
		]);
		const directories = new Set<string>();
		let savedData: unknown = null;
		const plugin = {
			loadData: async () => null,
			saveData: async (data: unknown) => {
				savedData = structuredClone(data);
			},
		} as Plugin;
		const app = {
			vault: {
				configDir: '.obsidian',
				adapter: {
					exists: async (path: string) => files.has(path) || directories.has(path),
					read: async (path: string) => files.get(path)!,
					mkdir: async (path: string) => {
						directories.add(path);
					},
					write: async (path: string, data: string) => {
						files.set(path, data);
					},
				},
			},
		} as unknown as App;
		const coordinator = new KnowledgeSuiteDataCoordinator(plugin);

		const first = await coordinator.importLegacyData(app);
		expect(first.alreadyCompleted).toBe(false);
		expect(first.sources['obsidian-excalidraw-plugin'].status).toBe('imported');
		expect(first.sources['knowledge-map'].status).toBe('imported');
		expect(files.get('.obsidian/plugins/obsidian-excalidraw-plugin/data.json'))
			.toBe('{"theme":"dark"}');
		expect(files.get('.obsidian/plugins/knowledge-map/data.json'))
			.toBe('{"schemaVersion":8,"mapStates":{}}');
		expect(files.get(first.sources['obsidian-excalidraw-plugin'].backupPath!))
			.toBe('{"theme":"dark"}');
		expect(files.get(first.sources['knowledge-map'].backupPath!))
			.toBe('{"schemaVersion":8,"mapStates":{}}');
		expect(savedData).toMatchObject({
			format: 'knowledge-suite-data',
			schemaVersion: 1,
			excalidraw: { theme: 'dark' },
			knowledgeMap: { schemaVersion: 8, mapStates: {} },
		});
		await coordinator.documentMetadata.saveData({ schemaVersion: 1, fields: [] });
		expect(savedData).toMatchObject({
			excalidraw: { theme: 'dark' },
			knowledgeMap: { schemaVersion: 8, mapStates: {} },
			documentMetadata: { schemaVersion: 1, fields: [] },
		});
		await coordinator.semanticUnits.saveData({ schemaVersion: 1, units: {}, instances: {} });
		expect(savedData).toMatchObject({
			excalidraw: { theme: 'dark' },
			knowledgeMap: { schemaVersion: 8, mapStates: {} },
			documentMetadata: { schemaVersion: 1, fields: [] },
			semanticUnits: { schemaVersion: 1, units: {}, instances: {} },
		});

		const fileCountAfterFirstImport = files.size;
		const second = await coordinator.importLegacyData(app);
		expect(second.alreadyCompleted).toBe(true);
		expect(files.size).toBe(fileCountAfterFirstImport);
	});
});
