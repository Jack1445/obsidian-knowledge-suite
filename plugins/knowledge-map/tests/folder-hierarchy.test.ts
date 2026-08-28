import { describe, expect, it } from 'vitest';
import { compareMapNodes, createContainmentEdges, type MapNode } from '../src/core/graph';

describe('folder hierarchy graph', () => {
	it('sorts folders before notes and uses a stable natural label order', () => {
		const nodes: MapNode[] = [
			{ id: 'note:Note 10.md', path: 'Note 10.md', label: 'Note 10', kind: 'note' },
			{ id: 'folder:Folder 2', path: 'Folder 2', label: 'Folder 2', kind: 'folder' },
			{ id: 'note:Note 2.md', path: 'Note 2.md', label: 'Note 2', kind: 'note' },
		];

		expect(nodes.sort(compareMapNodes).map((node) => node.label)).toEqual([
			'Folder 2',
			'Note 2',
			'Note 10',
		]);
	});

	it('connects the current folder to every direct child', () => {
		const parent: MapNode = {
			id: 'current-folder:Projects',
			path: 'Projects',
			label: 'Projects',
			kind: 'current-folder',
		};
		const children: MapNode[] = [
			{ id: 'folder:Projects/App', path: 'Projects/App', label: 'App', kind: 'folder' },
			{ id: 'note:Projects/Plan.md', path: 'Projects/Plan.md', label: 'Plan', kind: 'note' },
		];

		expect(createContainmentEdges(parent, children)).toEqual([
			{
				id: 'containment:Projects->Projects/App',
				from: parent.id,
				to: children[0]?.id,
				kind: 'containment',
				weight: 1,
			},
			{
				id: 'containment:Projects->Projects/Plan.md',
				from: parent.id,
				to: children[1]?.id,
				kind: 'containment',
				weight: 1,
			},
		]);
	});
});
