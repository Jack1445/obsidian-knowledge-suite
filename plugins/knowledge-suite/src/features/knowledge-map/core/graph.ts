export type MapNodeKind = 'current-folder' | 'folder' | 'note' | 'external-note';

export interface MapNode {
	id: string;
	path: string;
	label: string;
	kind: MapNodeKind;
}

export interface MapEdge {
	id: string;
	from: string;
	to: string;
	kind: 'containment' | 'link';
	weight: number;
}

export interface FolderGraph {
	folderPath: string;
	nodes: MapNode[];
	edges: MapEdge[];
}

export interface Point {
	x: number;
	y: number;
}

export interface ViewportState extends Point {
	zoom: number;
}

export interface SavedNodePosition extends Point {
	fixed: boolean;
}

export interface FolderMapState {
	viewport: ViewportState;
	nodes: Record<string, SavedNodePosition>;
}

export const ROOT_PATH = '/';

export function nodeId(kind: MapNodeKind, path: string): string {
	return `${kind}:${path}`;
}

export function compareMapNodes(left: MapNode, right: MapNode): number {
	const rank: Record<MapNodeKind, number> = {
		'current-folder': -1,
		folder: 0,
		note: 1,
		'external-note': 2,
	};
	return rank[left.kind] - rank[right.kind]
		|| left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' })
		|| left.path.localeCompare(right.path);
}

export function createContainmentEdges(parent: MapNode, children: MapNode[]): MapEdge[] {
	return children.map((child) => ({
		id: `containment:${parent.path}->${child.path}`,
		from: parent.id,
		to: child.id,
		kind: 'containment',
		weight: 1,
	}));
}
