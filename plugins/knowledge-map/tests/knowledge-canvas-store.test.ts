import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { KnowledgeMapStore } from '../src/data/store';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('knowledge canvas relationships', () => {
	it('persists and reuses a child canvas for the same parent and folder', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();

		store.registerKnowledgeCanvas('Parent.excalidraw.md', 'Projects');
		store.registerKnowledgeCanvas(
			'Child.excalidraw.md',
			'Projects/Child',
			'Parent.excalidraw.md',
		);

		expect(store.findChildKnowledgeCanvas('Parent.excalidraw.md', 'Projects/Child'))
			.toBe('Child.excalidraw.md');
		expect(store.getParentKnowledgeCanvasPath('Child.excalidraw.md'))
			.toBe('Parent.excalidraw.md');
		await store.flush();
	});

	it('detaches children when their parent canvas is removed', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('Parent.excalidraw.md', 'Projects');
		store.registerKnowledgeCanvas(
			'Child.excalidraw.md',
			'Projects/Child',
			'Parent.excalidraw.md',
		);

		store.removeKnowledgeCanvas('Parent.excalidraw.md');

		expect(store.getParentKnowledgeCanvasPath('Child.excalidraw.md')).toBeNull();
		await store.flush();
	});

	it('keeps 2d and 3d children distinct under the same parent and folder', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('Parent.excalidraw.md', 'Projects');
		store.registerKnowledgeCanvas('Child.excalidraw.md', 'Projects/Child', 'Parent.excalidraw.md');
		store.registerKnowledgeCanvas('Child.canvas3d', 'Projects/Child', 'Parent.excalidraw.md', '3d');

		expect(store.findChildKnowledgeCanvas('Parent.excalidraw.md', 'Projects/Child', '2d'))
			.toBe('Child.excalidraw.md');
		expect(store.findChildKnowledgeCanvas('Parent.excalidraw.md', 'Projects/Child', '3d'))
			.toBe('Child.canvas3d');
		await store.flush();
	});

	it('reparents an existing canvas and rotates an ancestor under its former child', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('First.excalidraw.md', 'First');
		store.registerKnowledgeCanvas('Second.excalidraw.md', 'Second');
		store.registerKnowledgeCanvas('World.canvas3d', 'World', 'First.excalidraw.md', '3d');

		expect(store.setParentKnowledgeCanvas('World.canvas3d', 'Second.excalidraw.md')).toBe(true);
		expect(store.getParentKnowledgeCanvasPath('World.canvas3d')).toBe('Second.excalidraw.md');
		expect(store.setParentKnowledgeCanvas('Second.excalidraw.md', 'World.canvas3d')).toBe(true);
		expect(store.getParentKnowledgeCanvasPath('Second.excalidraw.md')).toBe('World.canvas3d');
		expect(store.getParentKnowledgeCanvasPath('World.canvas3d')).toBeNull();
		await store.flush();
	});

	it('stores references independently from the structural parent relationship', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('One.excalidraw.md', 'One');
		store.registerKnowledgeCanvas('Two.canvas3d', 'Two', 'One.excalidraw.md', '3d');

		expect(store.addCanvasReference('One.excalidraw.md', 'Two.canvas3d')).toBe(true);
		expect(store.addCanvasReference('Two.canvas3d', 'One.excalidraw.md')).toBe(true);
		expect(store.getOutgoingCanvasReferences('One.excalidraw.md')).toEqual(['Two.canvas3d']);
		expect(store.getIncomingCanvasReferences('One.excalidraw.md')).toEqual(['Two.canvas3d']);
		expect(store.clearParentKnowledgeCanvas('Two.canvas3d', 'One.excalidraw.md')).toBe(true);
		expect(store.getParentKnowledgeCanvasPath('Two.canvas3d')).toBeNull();
		expect(store.getOutgoingCanvasReferences('One.excalidraw.md')).toEqual(['Two.canvas3d']);
		await store.flush();
	});

	it('persists independent sibling orders and moves canvases between order groups', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		let saved: unknown;
		const plugin = {
			loadData: async () => null,
			saveData: async (data: unknown) => { saved = structuredClone(data); },
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('Parent.excalidraw.md', 'Parent');
		store.registerKnowledgeCanvas('First.excalidraw.md', 'First');
		store.registerKnowledgeCanvas('Second.excalidraw.md', 'Second');
		store.registerKnowledgeCanvas('Child A.excalidraw.md', 'A', 'Parent.excalidraw.md');
		store.registerKnowledgeCanvas('Child B.excalidraw.md', 'B', 'Parent.excalidraw.md');

		store.setCanvasOrder(undefined, [
			'Second.excalidraw.md',
			'Parent.excalidraw.md',
			'First.excalidraw.md',
		]);
		store.setCanvasOrder('Parent.excalidraw.md', [
			'Child B.excalidraw.md',
			'Child A.excalidraw.md',
		]);
		expect(store.getCanvasOrders()).toMatchObject({
			'/': ['Second.excalidraw.md', 'Parent.excalidraw.md', 'First.excalidraw.md'],
			'Parent.excalidraw.md': ['Child B.excalidraw.md', 'Child A.excalidraw.md'],
		});

		expect(store.clearParentKnowledgeCanvas('Child B.excalidraw.md')).toBe(true);
		expect(store.getCanvasOrders()['Parent.excalidraw.md']).toEqual(['Child A.excalidraw.md']);
		const rootOrder = store.getCanvasOrders()['/'];
		expect(rootOrder?.[rootOrder.length - 1]).toBe('Child B.excalidraw.md');
		await store.flush();
		const savedRootOrder = (saved as { canvasOrder: Record<string, string[]> }).canvasOrder['/'];
		expect(savedRootOrder?.[savedRootOrder.length - 1]).toBe('Child B.excalidraw.md');
	});

	it('remaps ordered canvas paths when files are renamed or moved', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const plugin = {
			loadData: async () => null,
			saveData: async () => undefined,
		} as unknown as Plugin;
		const store = new KnowledgeMapStore(plugin);
		await store.load();
		store.registerKnowledgeCanvas('Folder/Parent.excalidraw.md', 'Folder');
		store.registerKnowledgeCanvas(
			'Folder/Child.excalidraw.md',
			'Folder/Child',
			'Folder/Parent.excalidraw.md',
		);

		store.migratePath('Folder', 'Renamed');

		expect(store.getCanvasOrders()['/']).toEqual(['Renamed/Parent.excalidraw.md']);
		expect(store.getCanvasOrders()['Renamed/Parent.excalidraw.md'])
			.toEqual(['Renamed/Child.excalidraw.md']);
		await store.flush();
	});
});
