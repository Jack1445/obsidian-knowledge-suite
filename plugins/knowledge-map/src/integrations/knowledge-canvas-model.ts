import type { MapEdge, MapNodeKind } from '../core/graph';
import type { KnowledgeCanvasType } from '../data/schema';

export const KNOWLEDGE_CANVAS_LINK_PREFIX = 'knowledge-map://';
export const KNOWLEDGE_CANVAS_DATA_KEY = 'knowledgeMap';

export type KnowledgeCanvasAction = 'folder' | 'back' | 'reset' | 'root';
export type KnowledgeCanvasElementRole = 'edge' | 'formula' | 'header' | 'label' | 'navigation' | 'node';
export type KnowledgeCanvasElementScope = 'manual' | 'map';
export type KnowledgeCanvasElementPart = 'body' | 'icon' | 'label';
export type KnowledgeCanvasNodePalette =
	| 'amber'
	| 'black'
	| 'blue'
	| 'brown'
	| 'cyan'
	| 'custom'
	| 'default'
	| 'gray'
	| 'green'
	| 'indigo'
	| 'lime'
	| 'magenta'
	| 'orange'
	| 'pink'
	| 'purple'
	| 'red'
	| 'rose'
	| 'teal'
	| 'violet'
	| 'yellow';
export type KnowledgeCanvasNodeShape = 'diamond' | 'ellipse' | 'rectangle' | 'rounded';
export type KnowledgeCanvasNodeIconKind = 'auto' | 'emoji' | 'lucide' | 'none' | 'symbol' | 'text';

export interface KnowledgeCanvasNodeIcon {
	kind: KnowledgeCanvasNodeIconKind;
	value?: string;
}

export interface KnowledgeCanvasNodeAppearance {
	palette: KnowledgeCanvasNodePalette;
	shape: KnowledgeCanvasNodeShape;
	customColor?: string;
	icon: KnowledgeCanvasNodeIcon;
}

export interface KnowledgeCanvasElementData {
	managed: true;
	scope: KnowledgeCanvasElementScope;
	role: KnowledgeCanvasElementRole;
	action?: KnowledgeCanvasAction;
	canvasType?: KnowledgeCanvasType;
	edgeKind?: MapEdge['kind'];
	iconVersion?: number;
	visualVersion?: number;
	latex?: string;
	nodeKind?: MapNodeKind;
	part?: KnowledgeCanvasElementPart;
	path?: string;
	appearance?: KnowledgeCanvasNodeAppearance;
}

export interface KnowledgeCanvasLink {
	action: KnowledgeCanvasAction;
	path?: string;
}

export type KnowledgeCanvasFolderActivation = 'open-child-canvas';
export type KnowledgeCanvasContextTarget = 'canvas' | 'file' | 'folder' | 'native';

export const DEFAULT_KNOWLEDGE_CANVAS_NODE_APPEARANCE: KnowledgeCanvasNodeAppearance = {
	palette: 'default',
	shape: 'ellipse',
	icon: { kind: 'auto' },
};

export function mergeKnowledgeCanvasNodeAppearance(
	appearance: Partial<KnowledgeCanvasNodeAppearance> | null | undefined,
	patch: Partial<KnowledgeCanvasNodeAppearance> = {},
): KnowledgeCanvasNodeAppearance {
	return {
		...DEFAULT_KNOWLEDGE_CANVAS_NODE_APPEARANCE,
		...appearance,
		...patch,
	};
}

export function normalizeCustomNodeColor(color: string): string | null {
	const normalized = color.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function createCustomNodeColorScheme(color: string): {
	stroke: string;
	background: string;
	text: string;
} | null {
	const stroke = normalizeCustomNodeColor(color);
	if (!stroke) return null;
	const channels = [
		Number.parseInt(stroke.slice(1, 3), 16),
		Number.parseInt(stroke.slice(3, 5), 16),
		Number.parseInt(stroke.slice(5, 7), 16),
	] as const;
	const mix = (target: number, amount: number): string => {
		return `#${channels.map((channel) => {
			return Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0');
		}).join('')}`;
	};
	const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 255000;
	return {
		stroke,
		background: mix(255, 0.84),
		text: mix(0, luminance > 0.72 ? 0.58 : 0.38),
	};
}

/**
 * Excalidraw persists data-URL images by decoding them into vault attachments.
 * Base64 SVGs survive that binary conversion, while URL-encoded UTF-8 SVGs can
 * remain visible only in the current scene and reopen as missing images.
 */
export function createSvgBase64DataUrl(svg: string): string {
	const bytes = new TextEncoder().encode(svg);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Folder navigation always crosses a persisted parent/child canvas edge.
 * Keeping every folder map in its own drawing prevents generated layers from
 * replacing either managed or manually added content in the source canvas.
 */
export function getKnowledgeCanvasFolderActivation(
	_data: Pick<KnowledgeCanvasElementData, 'scope'>,
): KnowledgeCanvasFolderActivation {
	return 'open-child-canvas';
}

export function canNavigateBackFromKnowledgeCanvas(state: {
	historyIndex: number;
	parentCanvasPath?: string;
}): boolean {
	return state.historyIndex > 0 || Boolean(state.parentCanvasPath);
}

/**
 * Excalidraw can reuse one view instance when a tab opens another drawing.
 * Event handlers therefore have to prefer the file currently attached to the
 * view instead of the file that happened to be open when they were registered.
 */
export function resolveCurrentViewFile<T>(boundFile: T, currentFile: T | null | undefined): T {
	return currentFile ?? boundFile;
}

/**
 * Uses the pointer hit whenever precise Excalidraw hit testing is available.
 * `null` deliberately means the pointer is on blank canvas; only `undefined`
 * falls back to the legacy selected element for older Excalidraw builds.
 */
export function resolveContextMenuElement<T>(
	hitElement: T | null | undefined,
	selectedElement: T | null | undefined,
): T | null {
	return hitElement === undefined ? selectedElement ?? null : hitElement;
}

/** Classifies a managed element without coupling menu routing to selection state. */
export function getKnowledgeCanvasContextTarget(
	data: KnowledgeCanvasElementData | null,
): KnowledgeCanvasContextTarget {
	if (data?.canvasType && data.path) return 'canvas';
	if (!data?.path || data.role !== 'node' && data.role !== 'label') return 'native';
	if (data.nodeKind === 'folder' || data.nodeKind === 'current-folder') return 'folder';
	if (data.nodeKind === 'note' || data.nodeKind === 'external-note') return 'file';
	return 'native';
}

export function findKnowledgeCanvasFolderNode<T extends { customData?: unknown }>(
	elements: readonly T[],
	folderPath: string,
): T | null {
	return elements.find((element) => {
		const data = readKnowledgeCanvasData(element);
		return data?.role === 'node'
			&& data.nodeKind === 'folder'
			&& data.path === folderPath;
	}) ?? null;
}

export function createKnowledgeCanvasLink(action: KnowledgeCanvasAction, path?: string): string {
	const suffix = path === undefined ? '' : `?path=${encodeURIComponent(path)}`;
	return `${KNOWLEDGE_CANVAS_LINK_PREFIX}${action}${suffix}`;
}

export function parseKnowledgeCanvasLink(link: string): KnowledgeCanvasLink | null {
	if (!link.startsWith(KNOWLEDGE_CANVAS_LINK_PREFIX)) return null;
	try {
		const url = new URL(link);
		if (
			url.hostname !== 'folder'
			&& url.hostname !== 'back'
			&& url.hostname !== 'reset'
			&& url.hostname !== 'root'
		) return null;
		const path = url.searchParams.get('path') ?? undefined;
		if (url.hostname === 'folder' && !path) return null;
		return { action: url.hostname, path };
	} catch {
		return null;
	}
}

export function readKnowledgeCanvasData(element: { customData?: unknown }): KnowledgeCanvasElementData | null {
	if (!element.customData || typeof element.customData !== 'object') return null;
	const value = (element.customData as Record<string, unknown>)[KNOWLEDGE_CANVAS_DATA_KEY];
	if (!value || typeof value !== 'object') return null;
	const data = value as Partial<KnowledgeCanvasElementData>;
	return data.managed === true && typeof data.scope === 'string' && typeof data.role === 'string'
		? data as KnowledgeCanvasElementData
		: null;
}
