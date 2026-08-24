import type { KnowledgeCanvasState, KnowledgeCanvasType } from '../data/schema';

export interface CanvasTreeNode {
	filePath: string;
	canvasType: KnowledgeCanvasType;
	folderPath: string;
	parentCanvasPath?: string;
	children: CanvasTreeNode[];
}

export interface CanvasReferenceEntry {
	filePath: string;
	direction: 'outgoing' | 'incoming' | 'both';
}

export function canvasDisplayName(filePath: string): string {
	const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
	return fileName
		.replace(/\.excalidraw\.md$/i, '')
		.replace(/\.canvas3d$/i, '')
		.replace(/\.md$/i, '')
		.replace(/^Vault(?=\s|$)/i, '仓库')
		.replace(/\bknowledge canvas\b/gi, '2维画布')
		.replace(/\bblank canvas\b/gi, '空白画布');
}

export function canvasRenamePath(filePath: string, requestedName: string): string | null {
	const name = requestedName
		.trim()
		.replace(/\.excalidraw\.md$/i, '')
		.replace(/\.md$/i, '');
	if (!name || /[\\/:*?"<>|]/.test(name)) return null;
	const slash = filePath.lastIndexOf('/');
	const folder = slash < 0 ? '' : filePath.slice(0, slash + 1);
	const suffix = /\.excalidraw\.md$/i.test(filePath)
		? '.excalidraw.md'
		: /\.canvas3d$/i.test(filePath) ? '.canvas3d' : '.md';
	return `${folder}${name}${suffix}`;
}

export function canvasMovePath(filePath: string, folderPath: string): string {
	const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
	return folderPath === '/' || folderPath === '' ? fileName : `${folderPath}/${fileName}`;
}

export function mergeCanvasReferences(
	outgoingPaths: readonly string[],
	incomingPaths: readonly string[],
): CanvasReferenceEntry[] {
	const directions = new Map<string, { outgoing: boolean; incoming: boolean }>();
	for (const filePath of outgoingPaths) directions.set(filePath, { outgoing: true, incoming: false });
	for (const filePath of incomingPaths) {
		const current = directions.get(filePath) ?? { outgoing: false, incoming: false };
		current.incoming = true;
		directions.set(filePath, current);
	}
	return [...directions.entries()]
		.map(([filePath, direction]): CanvasReferenceEntry => ({
			filePath,
			direction: direction.outgoing && direction.incoming
				? 'both'
				: direction.outgoing ? 'outgoing' : 'incoming',
		}))
		.sort((left, right) => canvasDisplayName(left.filePath).localeCompare(
			canvasDisplayName(right.filePath),
			undefined,
			{ numeric: true, sensitivity: 'base' },
		));
}

export function buildCanvasTree(
	entries: readonly (readonly [string, KnowledgeCanvasState])[],
	canvasOrder: Readonly<Record<string, readonly string[]>> = {},
): CanvasTreeNode[] {
	const states = new Map(entries);
	const nodes = new Map<string, CanvasTreeNode>();
	for (const [filePath, state] of entries) {
		nodes.set(filePath, {
			filePath,
			canvasType: state.canvasType,
			folderPath: state.folderPath,
			...(state.parentCanvasPath ? { parentCanvasPath: state.parentCanvasPath } : {}),
			children: [],
		});
	}

	const createsCycle = (filePath: string, parentCanvasPath: string): boolean => {
		const visited = new Set([filePath]);
		let cursor: string | undefined = parentCanvasPath;
		while (cursor) {
			if (visited.has(cursor)) return true;
			visited.add(cursor);
			cursor = states.get(cursor)?.parentCanvasPath;
		}
		return false;
	};

	const roots: CanvasTreeNode[] = [];
	for (const node of nodes.values()) {
		const parentPath = node.parentCanvasPath;
		const parent = parentPath ? nodes.get(parentPath) : undefined;
		if (parent && !createsCycle(node.filePath, parent.filePath)) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortNodes = (items: CanvasTreeNode[], parentCanvasPath?: string): void => {
		const orderedPaths = canvasOrder[parentCanvasPath ?? '/'] ?? [];
		const order = new Map(orderedPaths.map((filePath, index) => [filePath, index]));
		items.sort((left, right) => {
			const leftIndex = order.get(left.filePath);
			const rightIndex = order.get(right.filePath);
			if (leftIndex !== undefined || rightIndex !== undefined) {
				if (leftIndex === undefined) return 1;
				if (rightIndex === undefined) return -1;
				if (leftIndex !== rightIndex) return leftIndex - rightIndex;
			}
			const byName = canvasDisplayName(left.filePath).localeCompare(
				canvasDisplayName(right.filePath),
				undefined,
				{ numeric: true, sensitivity: 'base' },
			);
			return byName || left.filePath.localeCompare(right.filePath);
		});
		for (const item of items) sortNodes(item.children, item.filePath);
	};
	sortNodes(roots);
	return roots;
}
