export const NODE_DRAG_THRESHOLD = 5;

export function exceedsDragThreshold(
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
	threshold = NODE_DRAG_THRESHOLD,
): boolean {
	return Math.hypot(currentX - startX, currentY - startY) >= threshold;
}
