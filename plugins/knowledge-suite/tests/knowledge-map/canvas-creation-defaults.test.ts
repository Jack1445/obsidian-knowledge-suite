import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../../src/features/knowledge-map/data/schema';
import {
	resolveCanvasBaseName,
	resolveCanvasStorageFolder,
} from '../../src/features/knowledge-map/services/canvas-creation-defaults';

describe('managed canvas creation defaults', () => {
	it('preserves generated names and storage folders when unset', () => {
		const settings = createDefaultData().settings;
		const now = new Date('2026-08-31T10:20:30.000Z');

		expect(resolveCanvasBaseName('2d', 'Projects', settings, now))
			.toBe('Projects 2维画布 2026-08-31 10-20-30');
		expect(resolveCanvasBaseName('2d', '/', settings, now, '空白画布'))
			.toBe('空白画布 2026-08-31 10-20-30');
		expect(resolveCanvasBaseName('3d', '/', settings, now))
			.toBe('仓库 3维画布 2026-08-31 10-20-30');
		expect(resolveCanvasStorageFolder('2d', '/', settings)).toBeUndefined();
		expect(resolveCanvasStorageFolder('2d', 'Projects', settings)).toBe('Projects');
		expect(resolveCanvasStorageFolder('3d', '/', settings)).toBe('/');
	});

	it('uses safe custom names and independent configured folders', () => {
		const settings = {
			...createDefaultData().settings,
			default2dCanvasName: ' 项目/总览.excalidraw.md ',
			default3dCanvasName: '知识星球.knowledge-globe',
			default2dCanvasFolder: 'Canvas\\Two',
			default3dCanvasFolder: '/',
		};

		expect(resolveCanvasBaseName('2d', 'Projects', settings)).toBe('项目-总览');
		expect(resolveCanvasBaseName('3d', 'Projects', settings)).toBe('知识星球');
		expect(resolveCanvasStorageFolder('2d', 'Projects', settings)).toBe('Canvas/Two');
		expect(resolveCanvasStorageFolder('3d', 'Projects', settings)).toBe('/');
	});
});
