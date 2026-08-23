import { describe, expect, it } from 'vitest';
import { exceedsDragThreshold } from '../src/services/pointer-gesture';

describe('pointer gesture threshold', () => {
	it('keeps small pointer movement as a click', () => {
		expect(exceedsDragThreshold(100, 100, 103, 103)).toBe(false);
	});

	it('treats meaningful movement as a drag', () => {
		expect(exceedsDragThreshold(100, 100, 106, 100)).toBe(true);
	});
});
