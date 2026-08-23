import type { MapEdge, MapNodeKind } from '../core/graph';

export const KNOWLEDGE_CANVAS_LINK_PREFIX = 'knowledge-map://';
export const KNOWLEDGE_CANVAS_DATA_KEY = 'knowledgeMap';

export type KnowledgeCanvasAction = 'folder' | 'back' | 'reset' | 'root';
export type KnowledgeCanvasElementRole = 'edge' | 'formula' | 'header' | 'label' | 'navigation' | 'node';
export type KnowledgeCanvasElementScope = 'manual' | 'map';

export interface KnowledgeCanvasElementData {
	managed: true;
	scope: KnowledgeCanvasElementScope;
	role: KnowledgeCanvasElementRole;
	action?: KnowledgeCanvasAction;
	edgeKind?: MapEdge['kind'];
	latex?: string;
	nodeKind?: MapNodeKind;
	path?: string;
}

export interface KnowledgeCanvasLink {
	action: KnowledgeCanvasAction;
	path?: string;
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
