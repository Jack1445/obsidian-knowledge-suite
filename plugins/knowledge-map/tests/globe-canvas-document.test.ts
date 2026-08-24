import { describe, expect, it } from 'vitest';
import {
	addGlobeCanvasNodes,
	createEmptyGlobeCanvasDocument,
	parseGlobeCanvasDocument,
	serializeGlobeCanvasDocument,
	setGlobeCanvasNodePosition,
} from '../src/globe/globe-canvas-document';

describe('3d canvas document', () => {
	it('starts empty and round-trips its dragged nodes', () => {
		const document = addGlobeCanvasNodes(createEmptyGlobeCanvasDocument(), [{
			id: 'note:Notes/Alpha.md',
			kind: 'note',
			path: 'Notes/Alpha.md',
			label: 'Alpha',
			position: { lat: 31.2, lng: 121.5 },
		}]);

		expect(parseGlobeCanvasDocument(serializeGlobeCanvasDocument(document))).toEqual(document);
	});

	it('updates positions without changing other file nodes', () => {
		const document = addGlobeCanvasNodes(createEmptyGlobeCanvasDocument(), [{
			id: 'folder:Projects',
			kind: 'folder',
			path: 'Projects',
			label: 'Projects',
			position: { lat: 0, lng: 0 },
		}]);

		expect(setGlobeCanvasNodePosition(document, 'folder:Projects', { lat: 20, lng: 30 })
			.nodes[0]?.position).toEqual({ lat: 20, lng: 30 });
	});

	it('recovers safely from invalid file contents', () => {
		expect(parseGlobeCanvasDocument('not json')).toEqual(createEmptyGlobeCanvasDocument());
	});
});
