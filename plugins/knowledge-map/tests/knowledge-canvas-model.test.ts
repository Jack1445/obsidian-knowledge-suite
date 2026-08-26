import { describe, expect, it } from 'vitest';
import {
	canNavigateBackFromKnowledgeCanvas,
	createCustomNodeColorScheme,
	createSvgBase64DataUrl,
	createKnowledgeCanvasLink,
	findKnowledgeCanvasFolderNode,
	getKnowledgeCanvasContextTarget,
	getKnowledgeCanvasFolderActivation,
	mergeKnowledgeCanvasNodeAppearance,
	normalizeCustomNodeColor,
	parseKnowledgeCanvasLink,
	readKnowledgeCanvasData,
	resolveContextMenuElement,
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

	it('merges persistent node appearance changes over the defaults', () => {
		expect(mergeKnowledgeCanvasNodeAppearance(undefined)).toEqual({
			palette: 'default',
			shape: 'ellipse',
			icon: { kind: 'auto' },
		});
		expect(mergeKnowledgeCanvasNodeAppearance(
			{ palette: 'teal' },
			{ shape: 'diamond' },
		)).toEqual({
			palette: 'teal',
			shape: 'diamond',
			icon: { kind: 'auto' },
		});
	});

	it('normalizes a custom color and derives persistent node colors from it', () => {
		expect(normalizeCustomNodeColor(' #12ABef ')).toBe('#12abef');
		expect(normalizeCustomNodeColor('#123')).toBeNull();
		expect(createCustomNodeColorScheme('#336699')).toEqual({
			stroke: '#336699',
			background: '#dee7ef',
			text: '#203f5f',
		});
	});

	it('encodes SVG icons as persistent base64 data URLs', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>图标</text></svg>';
		const dataUrl = createSvgBase64DataUrl(svg);
		expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
		const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
		const decoded = new TextDecoder().decode(
			Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)),
		);
		expect(decoded).toBe(svg);
	});

	it('persists a selected library icon, emoji, or custom character in node appearance', () => {
		expect(mergeKnowledgeCanvasNodeAppearance(undefined, {
			icon: { kind: 'lucide', value: 'brain' },
		}).icon).toEqual({ kind: 'lucide', value: 'brain' });
		expect(mergeKnowledgeCanvasNodeAppearance(undefined, {
			icon: { kind: 'emoji', value: '🧠' },
		}).icon).toEqual({ kind: 'emoji', value: '🧠' });
		expect(mergeKnowledgeCanvasNodeAppearance(undefined, {
			icon: { kind: 'text', value: 'AI' },
		}).icon).toEqual({ kind: 'text', value: 'AI' });
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

	it('uses the element under the context-menu pointer instead of a stale selection', () => {
		const previouslySelected = { id: 'canvas-a' };
		const pointerTarget = { id: 'canvas-b' };
		expect(resolveContextMenuElement(pointerTarget, previouslySelected)).toBe(pointerTarget);
		expect(resolveContextMenuElement(null, previouslySelected)).toBeNull();
		expect(resolveContextMenuElement(undefined, previouslySelected)).toBe(previouslySelected);
	});

	it('routes context menus by the managed node represented under the pointer', () => {
		expect(getKnowledgeCanvasContextTarget({
			managed: true,
			scope: 'manual',
			role: 'node',
			canvasType: '3d',
			path: 'World.canvas3d',
		})).toBe('canvas');
		expect(getKnowledgeCanvasContextTarget({
			managed: true,
			scope: 'manual',
			role: 'label',
			nodeKind: 'folder',
			path: 'Projects',
		})).toBe('folder');
		expect(getKnowledgeCanvasContextTarget({
			managed: true,
			scope: 'map',
			role: 'node',
			nodeKind: 'current-folder',
			path: 'Projects',
		})).toBe('folder');
		expect(getKnowledgeCanvasContextTarget({
			managed: true,
			scope: 'map',
			role: 'node',
			nodeKind: 'note',
			path: 'Projects/Note.md',
		})).toBe('file');
		expect(getKnowledgeCanvasContextTarget({
			managed: true,
			scope: 'manual',
			role: 'formula',
		})).toBe('native');
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
