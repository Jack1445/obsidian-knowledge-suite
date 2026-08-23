import { describe, expect, it } from 'vitest';
import { ROOT_PATH, nodeId } from '../src/core/graph';

describe('root graph presentation', () => {
	it('keeps a stable root path without requiring a visible Vault node', () => {
		expect(ROOT_PATH).toBe('/');
		expect(nodeId('folder', 'Projects')).toBe('folder:Projects');
	});
});

