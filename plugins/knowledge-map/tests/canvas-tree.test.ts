import { describe, expect, it } from 'vitest';
import type { KnowledgeCanvasState } from '../src/data/schema';
import {
	buildCanvasTree,
	canvasDisplayName,
	canvasNodeDisplayName,
	canvasMovePath,
	canvasRenamePath,
	mergeCanvasReferences,
} from '../src/services/canvas-tree';

function state(folderPath: string, parentCanvasPath?: string): KnowledgeCanvasState {
	return {
		canvasType: '2d',
		folderPath,
		history: [folderPath],
		historyIndex: 0,
		layouts: {},
		...(parentCanvasPath ? { parentCanvasPath } : {}),
	};
}

describe('canvas tree', () => {
	it('builds and sorts an arbitrarily deep parent-child hierarchy', () => {
		const tree = buildCanvasTree([
			['Child 10.excalidraw.md', state('Projects/Child 10', 'Parent.excalidraw.md')],
			['Grandchild.excalidraw.md', state('Projects/Child 2/Deep', 'Child 2.excalidraw.md')],
			['Parent.excalidraw.md', state('Projects')],
			['Child 2.excalidraw.md', state('Projects/Child 2', 'Parent.excalidraw.md')],
		]);

		expect(tree.map((node) => node.filePath)).toEqual(['Parent.excalidraw.md']);
		expect(tree[0]?.children.map((node) => node.filePath)).toEqual([
			'Child 2.excalidraw.md',
			'Child 10.excalidraw.md',
		]);
		expect(tree[0]?.children[0]?.children[0]?.filePath).toBe('Grandchild.excalidraw.md');
	});

	it('keeps missing-parent and cyclic canvases visible as roots', () => {
		const tree = buildCanvasTree([
			['Orphan.excalidraw.md', state('Orphan', 'Missing.excalidraw.md')],
			['Cycle A.excalidraw.md', state('A', 'Cycle B.excalidraw.md')],
			['Cycle B.excalidraw.md', state('B', 'Cycle A.excalidraw.md')],
		]);

		expect(tree.map((node) => node.filePath)).toEqual([
			'Cycle A.excalidraw.md',
			'Cycle B.excalidraw.md',
			'Orphan.excalidraw.md',
		]);
	});

	it('uses saved orders independently for roots and each sibling group', () => {
		const tree = buildCanvasTree([
			['Alpha.excalidraw.md', state('Alpha')],
			['Beta.excalidraw.md', state('Beta')],
			['Child A.excalidraw.md', state('Child A', 'Alpha.excalidraw.md')],
			['Child B.excalidraw.md', state('Child B', 'Alpha.excalidraw.md')],
		], {
			'/': ['Beta.excalidraw.md', 'Alpha.excalidraw.md'],
			'Alpha.excalidraw.md': ['Child B.excalidraw.md', 'Child A.excalidraw.md'],
		});

		expect(tree.map((node) => node.filePath)).toEqual([
			'Beta.excalidraw.md',
			'Alpha.excalidraw.md',
		]);
		expect(tree[1]?.children.map((node) => node.filePath)).toEqual([
			'Child B.excalidraw.md',
			'Child A.excalidraw.md',
		]);
	});

	it('uses a clean canvas name for the sidebar label', () => {
		expect(canvasDisplayName('生活/生活 knowledge canvas.excalidraw.md'))
			.toBe('生活 2维画布');
		expect(canvasDisplayName('Vault knowledge canvas 2026.excalidraw.md'))
			.toBe('仓库 2维画布 2026');
		expect(canvasDisplayName('Canvas.md')).toBe('Canvas');
		expect(canvasDisplayName('世界 3维画布.canvas3d')).toBe('世界 3维画布');
	});

	it('uses a compact generated name inside a canvas node', () => {
		expect(canvasNodeDisplayName('生活/生活 3维画布 2026-08-24 12-13-53.canvas3d'))
			.toBe('生活');
		expect(canvasNodeDisplayName('仓库 2维画布 2026-08-24 12-11-48.excalidraw.md'))
			.toBe('仓库');
		expect(canvasNodeDisplayName('顶层画布.excalidraw.md')).toBe('顶层画布');
	});

	it('preserves the canvas suffix when renaming and validates Windows file names', () => {
		expect(canvasRenamePath('生活/Old.excalidraw.md', 'New name'))
			.toBe('生活/New name.excalidraw.md');
		expect(canvasRenamePath('Canvas.md', 'New.md')).toBe('New.md');
		expect(canvasRenamePath('世界.canvas3d', '新世界')).toBe('新世界.canvas3d');
		expect(canvasRenamePath('Canvas.md', 'bad/name')).toBeNull();
	});

	it('moves a canvas without changing its file name', () => {
		expect(canvasMovePath('生活/Canvas.excalidraw.md', '思考/项目'))
			.toBe('思考/项目/Canvas.excalidraw.md');
		expect(canvasMovePath('生活/Canvas.excalidraw.md', '/'))
			.toBe('Canvas.excalidraw.md');
	});

	it('merges reciprocal references into one bidirectional entry', () => {
		expect(mergeCanvasReferences(
			['B.excalidraw.md', 'C.canvas3d'],
			['B.excalidraw.md', 'D.excalidraw.md'],
		)).toEqual([
			{ filePath: 'B.excalidraw.md', direction: 'both' },
			{ filePath: 'C.canvas3d', direction: 'outgoing' },
			{ filePath: 'D.excalidraw.md', direction: 'incoming' },
		]);
	});
});
