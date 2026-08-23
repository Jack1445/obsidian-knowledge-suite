import { describe, expect, it } from 'vitest';
import type { MapEdge } from '../src/core/graph';
import { createEdgePath } from '../src/services/edge-path';

describe('edge paths', () => {
	it('uses a vertical cubic curve for folder containment', () => {
		const edge: MapEdge = {
			id: 'containment:Projects->Projects/Plan.md',
			from: 'current-folder:Projects',
			to: 'note:Projects/Plan.md',
			kind: 'containment',
			weight: 1,
		};

		expect(createEdgePath(edge, { x: 0, y: -170 }, { x: 180, y: 70 }))
			.toBe('M 0 -170 C 0 -50 180 -50 180 70');
	});

	it('uses a bowed quadratic curve for note references', () => {
		const edge: MapEdge = {
			id: 'link:A.md->B.md',
			from: 'note:A.md',
			to: 'note:B.md',
			kind: 'link',
			weight: 1,
		};
		const path = createEdgePath(edge, { x: -90, y: 70 }, { x: 90, y: 70 });

		expect(path).toMatch(/^M -90 70 Q 0 (?:30\.4|109\.6) 90 70$/);
		expect(path).not.toContain(' C ');
	});

	it('separates reciprocal note references onto opposite arcs', () => {
		const forward: MapEdge = {
			id: 'link:A.md->B.md',
			from: 'note:A.md',
			to: 'note:B.md',
			kind: 'link',
			weight: 1,
		};
		const backward: MapEdge = {
			...forward,
			id: 'link:B.md->A.md',
			from: forward.to,
			to: forward.from,
		};

		expect(createEdgePath(forward, { x: -90, y: 70 }, { x: 90, y: 70 }))
			.not.toBe(createEdgePath(backward, { x: 90, y: 70 }, { x: -90, y: 70 }));
	});
});
