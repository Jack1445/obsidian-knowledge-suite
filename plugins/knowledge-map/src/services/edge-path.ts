import type { MapEdge, Point } from '../core/graph';

function stableCurveDirection(edgeId: string): number {
	let hash = 0;
	for (const character of edgeId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
	return (hash & 1) === 0 ? 1 : -1;
}

export function createEdgePath(edge: MapEdge, from: Point, to: Point): string {
	if (edge.kind === 'containment') {
		const middleY = (from.y + to.y) / 2;
		return `M ${from.x} ${from.y} C ${from.x} ${middleY} ${to.x} ${middleY} ${to.x} ${to.y}`;
	}

	const deltaX = to.x - from.x;
	const deltaY = to.y - from.y;
	const distance = Math.hypot(deltaX, deltaY);
	if (distance < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

	const bend = Math.min(84, Math.max(32, distance * 0.22)) * stableCurveDirection(edge.id);
	const middleX = (from.x + to.x) / 2;
	const middleY = (from.y + to.y) / 2;
	const controlX = middleX - deltaY / distance * bend;
	const controlY = middleY + deltaX / distance * bend;
	return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}
