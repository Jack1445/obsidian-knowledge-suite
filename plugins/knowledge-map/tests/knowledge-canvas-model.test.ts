import { describe, expect, it } from 'vitest';
import {
	canNavigateBackFromKnowledgeCanvas,
	createKnowledgeCanvasLink,
	findKnowledgeCanvasFolderNode,
	getKnowledgeCanvasFolderActivation,
	parseKnowledgeCanvasLink,
	readKnowledgeCanvasData,
	resolveCurrentViewFile,
} from '../src/integrations/knowledge-canvas-model';

describe('knowledge canvas metadata', () => {
	it('round-trips folder drill links with spaces and non-ASCII paths', () => {
		const link = createKnowledgeCanvasLink('folder', '生活/长期 项目');
		expect(parseKnowledgeCanvasLink(link)).toEqual({ action: 'folder', path: '生活/长期 项目' });
	});

	it('recognizes navigation links and rejects unrelated links', () => {
		expect(parseKnowledgeCanvasLink(createKnowledgeCanvasLink('back'))).toEqual({ action: 'back' });
		expect(parseKnowledgeCanvasLink(createKnowledgeCanvasLink('reset'))).toEqual({ action: 'reset' });
		expect(parseKnowledgeCanvasLink(createKnowledgeCanvasLink('root'))).toEqual({ action: 'root' });
		expect(parseKnowledgeCanvasLink('[[Note.md]]')).toBeNull();
	});

	it('reads only managed Knowledge Map custom data', () => {
		const data = { managed: true as const, scope: 'map' as const, role: 'node' as const, path: 'Projects' };
		expect(readKnowledgeCanvasData({ customData: { knowledgeMap: data } })).toEqual(data);
		expect(readKnowledgeCanvasData({ customData: { otherPlugin: data } })).toBeNull();
	});

	it('retains formula metadata as manual canvas content', () => {
		const data = {
			managed: true as const,
			scope: 'manual' as const,
			role: 'formula' as const,
			latex: '\\frac{a}{b}',
		};
		expect(readKnowledgeCanvasData({ customData: { knowledgeMap: data } })).toEqual(data);
	});

	it('preserves a 3d canvas node target', () => {
		const data = {
			managed: true as const,
			scope: 'manual' as const,
			role: 'node' as const,
			canvasType: '3d' as const,
			path: 'World.canvas3d',
		};
		expect(readKnowledgeCanvasData({ customData: { knowledgeMap: data } })).toEqual(data);
	});

	it('opens every folder as an independent child canvas', () => {
		expect(getKnowledgeCanvasFolderActivation({ scope: 'manual' })).toBe('open-child-canvas');
		expect(getKnowledgeCanvasFolderActivation({ scope: 'map' })).toBe('open-child-canvas');
	});

	it('shows Back only for an internal history entry or a parent canvas', () => {
		expect(canNavigateBackFromKnowledgeCanvas({ historyIndex: 0 })).toBe(false);
		expect(canNavigateBackFromKnowledgeCanvas({ historyIndex: 1 })).toBe(true);
		expect(canNavigateBackFromKnowledgeCanvas({
			historyIndex: 0,
			parentCanvasPath: 'Parent.excalidraw.md',
		})).toBe(true);
	});

	it('uses the current tab file after Excalidraw reuses a bound view', () => {
		const parent = { path: 'Parent.excalidraw.md' };
		const child = { path: 'Child.excalidraw.md' };
		expect(resolveCurrentViewFile(parent, child)).toBe(child);
		expect(resolveCurrentViewFile(parent, null)).toBe(parent);
	});

	it('finds the parent folder button that opened a child canvas', () => {
		const unrelated = {
			id: 'note',
			customData: {
				knowledgeMap: {
					managed: true,
					scope: 'map',
					role: 'node',
					nodeKind: 'note',
					path: '生活',
				},
			},
		};
		const folder = {
			id: 'folder',
			customData: {
				knowledgeMap: {
					managed: true,
					scope: 'map',
					role: 'node',
					nodeKind: 'folder',
					path: '生活',
				},
			},
		};
		expect(findKnowledgeCanvasFolderNode([unrelated, folder], '生活')).toBe(folder);
		expect(findKnowledgeCanvasFolderNode([folder], '思考')).toBeNull();
	});
});
