import { describe, expect, it } from 'vitest';
import {
	addGlobeCanvasNodes,
	createEmptyGlobeCanvasDocument,
	parseGlobeCanvasDocument,
	serializeGlobeCanvasDocument,
	setGlobeCanvasNodeAppearance,
	setGlobeCanvasNodePosition,
	setGlobeCanvasNodeSize,
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

	it('persists node color, shape, and icon appearance', () => {
		const document = addGlobeCanvasNodes(createEmptyGlobeCanvasDocument(), [{
			id: 'note:Notes/Alpha.md',
			kind: 'note',
			path: 'Notes/Alpha.md',
			label: 'Alpha',
			position: { lat: 31.2, lng: 121.5 },
		}]);
		const updated = setGlobeCanvasNodeAppearance(document, 'note:Notes/Alpha.md', {
			palette: 'teal',
			shape: 'rounded',
			icon: { kind: 'lucide', value: 'book-open' },
		});
		expect(parseGlobeCanvasDocument(serializeGlobeCanvasDocument(updated)).nodes[0]?.appearance).toEqual({
			palette: 'teal',
			shape: 'rounded',
			icon: { kind: 'lucide', value: 'book-open' },
		});
	});

	it('persists and clamps a resized globe node', () => {
		const document = addGlobeCanvasNodes(createEmptyGlobeCanvasDocument(), [{
			id: 'folder:Projects',
			kind: 'folder',
			path: 'Projects',
			label: 'Projects',
			position: { lat: 0, lng: 0 },
		}]);
		const updated = setGlobeCanvasNodeSize(document, 'folder:Projects', { width: 360, height: 40 });
		expect(parseGlobeCanvasDocument(serializeGlobeCanvasDocument(updated)).nodes[0]?.size).toEqual({
			width: 320,
			height: 40,
		});
	});
});
