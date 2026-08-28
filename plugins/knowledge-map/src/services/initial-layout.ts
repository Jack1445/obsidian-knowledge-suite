import { compareMapNodes, type FolderGraph, type MapNode, type SavedNodePosition } from '../core/graph';

const HORIZONTAL_GAP = 180;
const CURRENT_FOLDER_Y = -170;
const CHILD_ROW_Y = 70;
const ROOT_ROW_Y = 0;
const EXTERNAL_ROW_GAP = 170;

function rowPosition(index: number, total: number, y: number): SavedNodePosition {
	return {
		x: (index - (total - 1) / 2) * HORIZONTAL_GAP,
		y,
		fixed: false,
	};
}

function shouldKeepSavedPosition(node: MapNode, position: SavedNodePosition | undefined): boolean {
	if (!position?.fixed) return false;
	// Older releases marked the generated current-folder origin as fixed.
	// Treat that exact legacy coordinate as automatic so the new hierarchy layout can replace it.
	return !(node.kind === 'current-folder' && position.x === 0 && position.y === 0);
}

export function createInitialPositions(
	graph: FolderGraph,
	saved: Record<string, SavedNodePosition>,
): Record<string, SavedNodePosition> {
	const positions: Record<string, SavedNodePosition> = {};
	const current = graph.nodes.find((node) => node.kind === 'current-folder');
	const directChildren = graph.nodes
		.filter((node) => node.kind === 'folder' || node.kind === 'note')
		.sort(compareMapNodes);
	const externalNodes = graph.nodes
		.filter((node) => node.kind === 'external-note')
		.sort(compareMapNodes);

	if (current) positions[current.id] = { x: 0, y: CURRENT_FOLDER_Y, fixed: false };
	const childY = current ? CHILD_ROW_Y : ROOT_ROW_Y;
	directChildren.forEach((node, index) => {
		positions[node.id] = rowPosition(index, directChildren.length, childY);
	});
	externalNodes.forEach((node, index) => {
		positions[node.id] = rowPosition(index, externalNodes.length, childY + EXTERNAL_ROW_GAP);
	});

	for (const node of graph.nodes) {
		const existing = saved[node.id];
		if (existing && shouldKeepSavedPosition(node, existing)) positions[node.id] = { ...existing };
	}
	return positions;
}
