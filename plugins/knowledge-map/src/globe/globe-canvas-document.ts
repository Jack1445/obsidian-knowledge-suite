import type { MapNode } from '../core/graph';
import type { GlobePosition } from '../data/schema';

export const GLOBE_CANVAS_FILE_EXTENSION = 'canvas3d';
export const GLOBE_CANVAS_DOCUMENT_TYPE = 'knowledge-map-globe';
export const GLOBE_CANVAS_DOCUMENT_VERSION = 1;

export interface GlobeCanvasNode extends MapNode {
	kind: 'folder' | 'note';
	position: GlobePosition;
}

export interface GlobeCanvasDocument {
	type: typeof GLOBE_CANVAS_DOCUMENT_TYPE;
	version: typeof GLOBE_CANVAS_DOCUMENT_VERSION;
	nodes: GlobeCanvasNode[];
}

export function createEmptyGlobeCanvasDocument(): GlobeCanvasDocument {
	return {
		type: GLOBE_CANVAS_DOCUMENT_TYPE,
		version: GLOBE_CANVAS_DOCUMENT_VERSION,
		nodes: [],
	};
}

export function parseGlobeCanvasDocument(raw: string): GlobeCanvasDocument {
	try {
		const candidate = JSON.parse(raw) as Partial<GlobeCanvasDocument>;
		if (candidate.type !== GLOBE_CANVAS_DOCUMENT_TYPE || !Array.isArray(candidate.nodes)) {
			return createEmptyGlobeCanvasDocument();
		}
		const nodes = candidate.nodes.flatMap((node): GlobeCanvasNode[] => {
			if (
				!node
				|| typeof node.id !== 'string'
				|| typeof node.path !== 'string'
				|| typeof node.label !== 'string'
				|| node.kind !== 'folder' && node.kind !== 'note'
				|| typeof node.position?.lat !== 'number'
				|| typeof node.position.lng !== 'number'
			) return [];
			return [{
				id: node.id,
				path: node.path,
				label: node.label,
				kind: node.kind,
				position: {
					lat: Math.max(-90, Math.min(90, node.position.lat)),
					lng: normalizeLongitude(node.position.lng),
				},
			}];
		});
		return {
			type: GLOBE_CANVAS_DOCUMENT_TYPE,
			version: GLOBE_CANVAS_DOCUMENT_VERSION,
			nodes: [...new Map(nodes.map((node) => [node.path, node])).values()],
		};
	} catch {
		return createEmptyGlobeCanvasDocument();
	}
}

export function serializeGlobeCanvasDocument(document: GlobeCanvasDocument): string {
	return `${JSON.stringify(document, null, 2)}\n`;
}

export function addGlobeCanvasNodes(
	document: GlobeCanvasDocument,
	nodes: readonly GlobeCanvasNode[],
): GlobeCanvasDocument {
	const byPath = new Map(document.nodes.map((node) => [node.path, node]));
	for (const node of nodes) byPath.set(node.path, node);
	return { ...document, nodes: [...byPath.values()] };
}

export function setGlobeCanvasNodePosition(
	document: GlobeCanvasDocument,
	nodeId: string,
	position: GlobePosition,
): GlobeCanvasDocument {
	return {
		...document,
		nodes: document.nodes.map((node) => node.id === nodeId ? { ...node, position } : node),
	};
}

function normalizeLongitude(value: number): number {
	return ((value + 180) % 360 + 360) % 360 - 180;
}
