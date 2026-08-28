import { describe, expect, it } from 'vitest';
import type { FolderGraph, SavedNodePosition } from '../src/core/graph';
import { createInitialPositions } from '../src/services/initial-layout';

describe('hierarchical initial layout', () => {
	it('places the current folder above a stable row of sorted children', () => {
		const graph: FolderGraph = {
			folderPath: 'Projects',
			nodes: [
				{ id: 'note:Projects/Zebra.md', path: 'Projects/Zebra.md', label: 'Zebra', kind: 'note' },
				{ id: 'current-folder:Projects', path: 'Projects', label: 'Projects', kind: 'current-folder' },
				{ id: 'folder:Projects/Alpha', path: 'Projects/Alpha', label: 'Alpha', kind: 'folder' },
				{ id: 'note:Projects/Beta.md', path: 'Projects/Beta.md', label: 'Beta', kind: 'note' },
			],
			edges: [],
		};

		const positions = createInitialPositions(graph, {});

		expect(positions['current-folder:Projects']).toMatchObject({ x: 0, y: -170, fixed: false });
		expect(positions['folder:Projects/Alpha']).toMatchObject({ x: -180, y: 70, fixed: false });
		expect(positions['note:Projects/Beta.md']).toMatchObject({ x: 0, y: 70, fixed: false });
		expect(positions['note:Projects/Zebra.md']).toMatchObject({ x: 180, y: 70, fixed: false });
	});

	it('keeps positions that the user manually fixed', () => {
		const graph: FolderGraph = {
			folderPath: 'Projects',
			nodes: [
				{ id: 'current-folder:Projects', path: 'Projects', label: 'Projects', kind: 'current-folder' },
				{ id: 'note:Projects/Note.md', path: 'Projects/Note.md', label: 'Note', kind: 'note' },
			],
			edges: [],
		};
		const saved: Record<string, SavedNodePosition> = {
			'note:Projects/Note.md': { x: 420, y: 310, fixed: true },
		};

		const positions = createInitialPositions(graph, saved);

		expect(positions['note:Projects/Note.md']).toEqual({ x: 420, y: 310, fixed: true });
	});

	it('replaces the legacy generated current-folder origin', () => {
		const graph: FolderGraph = {
			folderPath: 'Projects',
			nodes: [
				{ id: 'current-folder:Projects', path: 'Projects', label: 'Projects', kind: 'current-folder' },
			],
			edges: [],
		};

		const positions = createInitialPositions(graph, {
			'current-folder:Projects': { x: 0, y: 0, fixed: true },
		});

		expect(positions['current-folder:Projects']).toEqual({ x: 0, y: -170, fixed: false });
	});
});
