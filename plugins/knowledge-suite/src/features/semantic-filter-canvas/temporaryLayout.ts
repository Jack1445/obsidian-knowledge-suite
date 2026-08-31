import type { SemanticUnitBounds } from "../semantic-units/types";

export type SemanticFilterCanvasPosition = {
  x: number;
  y: number;
};

export type SemanticFilterCanvasSize = {
  width: number;
  height: number;
};

export type SemanticFilterCanvasItem = SemanticFilterCanvasSize & {
  id: string;
};

const CARD_MIN_WIDTH = 480;
const CARD_MIN_HEIGHT = 420;
const CARD_HORIZONTAL_CHROME = 64;
const CARD_VERTICAL_CHROME = 120;
const HORIZONTAL_GAP = 36;
const VERTICAL_GAP = 38;
const STAGE_PADDING = 56;

const finiteDimension = (value: number): number => (
  Number.isFinite(value) ? Math.max(1, Math.ceil(value)) : 1
);

/**
 * Leaves the unit artwork at approximately 1 CSS pixel per source pixel.
 * Extra space accounts for the title bar, SVG export padding, and card inset.
 */
export const semanticFilterCardSize = (
  bounds: SemanticUnitBounds,
): SemanticFilterCanvasSize => ({
  width: Math.max(CARD_MIN_WIDTH, finiteDimension(bounds.width) + CARD_HORIZONTAL_CHROME),
  height: Math.max(CARD_MIN_HEIGHT, finiteDimension(bounds.height) + CARD_VERTICAL_CHROME),
});

const overlaps = (
  leftPosition: SemanticFilterCanvasPosition,
  leftSize: SemanticFilterCanvasSize,
  rightPosition: SemanticFilterCanvasPosition,
  rightSize: SemanticFilterCanvasSize,
): boolean => leftPosition.x < rightPosition.x + rightSize.width + HORIZONTAL_GAP &&
  leftPosition.x + leftSize.width + HORIZONTAL_GAP > rightPosition.x &&
  leftPosition.y < rightPosition.y + rightSize.height + VERTICAL_GAP &&
  leftPosition.y + leftSize.height + VERTICAL_GAP > rightPosition.y;

const findOpenPosition = (
  item: SemanticFilterCanvasItem,
  placed: ReadonlyMap<string, SemanticFilterCanvasPosition>,
  sizes: ReadonlyMap<string, SemanticFilterCanvasSize>,
  viewportWidth: number,
): SemanticFilterCanvasPosition => {
  const rowRight = Math.max(STAGE_PADDING + item.width, viewportWidth - STAGE_PADDING);
  let candidate = { x: STAGE_PADDING, y: STAGE_PADDING };
  let rowHeight = item.height;
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    if (candidate.x > STAGE_PADDING && candidate.x + item.width > rowRight) {
      candidate = { x: STAGE_PADDING, y: candidate.y + rowHeight + VERTICAL_GAP };
      rowHeight = item.height;
    }
    const collision = [...placed.entries()].find(([id, position]) => {
      const size = sizes.get(id);
      return size ? overlaps(candidate, item, position, size) : false;
    });
    if (!collision) return candidate;
    const [collisionId, collisionPosition] = collision;
    const collisionSize = sizes.get(collisionId);
    if (!collisionSize) continue;
    candidate = {
      x: collisionPosition.x + collisionSize.width + HORIZONTAL_GAP,
      y: candidate.y,
    };
    rowHeight = Math.max(rowHeight, collisionSize.height);
  }
  return { x: STAGE_PADDING, y: STAGE_PADDING + placed.size * (item.height + VERTICAL_GAP) };
};

/** Preserves dragged positions for surviving results and places only new units. */
export const buildTemporarySemanticLayout = (
  items: readonly SemanticFilterCanvasItem[],
  previous: ReadonlyMap<string, SemanticFilterCanvasPosition>,
  viewportWidth: number,
): Map<string, SemanticFilterCanvasPosition> => {
  const next = new Map<string, SemanticFilterCanvasPosition>();
  const sizes = new Map(items.map((item) => [item.id, {
    width: item.width,
    height: item.height,
  }]));
  for (const item of items) {
    const position = previous.get(item.id);
    if (position) next.set(item.id, { ...position });
  }
  for (const item of items) {
    if (next.has(item.id)) continue;
    next.set(item.id, findOpenPosition(item, next, sizes, viewportWidth));
  }
  return next;
};
