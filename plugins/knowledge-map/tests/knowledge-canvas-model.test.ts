import { describe, expect, it } from 'vitest';
import {
	createKnowledgeCanvasLink,
	parseKnowledgeCanvasLink,
	readKnowledgeCanvasData,
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
});
