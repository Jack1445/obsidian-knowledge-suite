import type {
	FolderGraph,
	MapNode,
	SavedNodePosition,
	ViewportState,
} from '../core/graph';
import { createEdgePath } from '../services/edge-path';
import { exceedsDragThreshold } from '../services/pointer-gesture';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

interface GraphRendererOptions {
	container: HTMLElement;
	graph: FolderGraph;
	positions: Record<string, SavedNodePosition>;
	viewport: ViewportState;
	showLabels: boolean;
	nodeScale: number;
	linkScale: number;
	onNodeActivate: (node: MapNode, event: MouseEvent) => void;
	onPositionChange: (nodeId: string, position: SavedNodePosition) => void;
	onViewportChange: (viewport: ViewportState) => void;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
	return document.createElementNS(SVG_NAMESPACE, name);
}

function visibleLabel(value: string, maximumLength = 18): string {
	const characters = [...value];
	return characters.length <= maximumLength
		? value
		: `${characters.slice(0, maximumLength - 1).join('')}…`;
}

export class GraphRenderer {
	private readonly svg = svgElement('svg');
	private readonly world = svgElement('g');
	private readonly edgeLayer = svgElement('g');
	private readonly nodeLayer = svgElement('g');
	private viewport: ViewportState;
	private destroyed = false;
	private panStart: { x: number; y: number; viewportX: number; viewportY: number } | null = null;
	private dragState: {
		node: MapNode;
		moved: boolean;
		startClientX: number;
		startClientY: number;
		startWorldX: number;
		startWorldY: number;
		startNodeX: number;
		startNodeY: number;
	} | null = null;
	private readonly nodeElements = new Map<string, SVGGElement>();
	private readonly edgeElements = new Map<string, SVGPathElement>();
	private readonly resizeObserver: ResizeObserver;

	constructor(private readonly options: GraphRendererOptions) {
		this.viewport = { ...options.viewport };
		this.svg.addClass('knowledge-map__svg');
		this.svg.setAttribute('role', 'application');
		this.svg.setAttribute('aria-label', `Knowledge map for ${options.graph.folderPath}`);
		this.world.append(this.edgeLayer, this.nodeLayer);
		this.svg.append(this.world);
		options.container.append(this.svg);
		this.resizeObserver = new ResizeObserver(() => this.applyViewport());
		this.resizeObserver.observe(this.svg);
		this.render();
		this.bindViewportEvents();
	}

	destroy(): void {
		this.destroyed = true;
		this.resizeObserver.disconnect();
		this.svg.remove();
	}

	resetViewport(): void {
		this.viewport = { x: 0, y: 0, zoom: 1 };
		this.applyViewport();
		this.options.onViewportChange({ ...this.viewport });
	}

	setNodeScale(scale: number): void {
		for (const element of this.nodeElements.values()) {
			element.style.setProperty('--knowledge-map-node-scale', `${scale}`);
		}
	}

	setLinkScale(scale: number): void {
		for (const element of this.edgeElements.values()) {
			element.style.setProperty('--knowledge-map-link-scale', `${scale}`);
		}
	}

	private render(): void {
		for (const edge of this.options.graph.edges) {
			const from = this.options.positions[edge.from];
			const to = this.options.positions[edge.to];
			if (!from || !to) continue;
			const path = svgElement('path');
			path.addClass('knowledge-map__edge', `is-${edge.kind}`);
			path.setAttribute('d', createEdgePath(edge, from, to));
			path.style.setProperty('--knowledge-map-link-scale', `${this.options.linkScale}`);
			const title = svgElement('title');
			title.textContent = edge.kind === 'containment' ? 'Folder hierarchy' : 'Note reference';
			path.append(title);
			this.edgeLayer.append(path);
			this.edgeElements.set(edge.id, path);
		}

		for (const node of this.options.graph.nodes) this.renderNode(node);
		this.applyViewport();
	}

	private renderNode(node: MapNode): void {
		const position = this.options.positions[node.id];
		if (!position) return;
		const group = svgElement('g');
		group.addClass('knowledge-map__node', `is-${node.kind}`);
		group.setAttribute('transform', `translate(${position.x} ${position.y})`);
		group.setAttribute('tabindex', '0');
		group.setAttribute('role', 'button');
		group.setAttribute('aria-label', `${node.label}, ${node.kind}`);
		group.style.setProperty('--knowledge-map-node-scale', `${this.options.nodeScale}`);
		const title = svgElement('title');
		title.textContent = node.label;
		group.append(title);

		const halo = svgElement('circle');
		halo.addClass('knowledge-map__node-halo');
		halo.setAttribute('r', '18');
		const circle = svgElement('circle');
		circle.addClass('knowledge-map__node-circle');
		circle.setAttribute('r', node.kind.includes('folder') ? '8' : '5');
		group.append(halo, circle);

		if (this.options.showLabels) {
			const label = svgElement('text');
			label.addClass('knowledge-map__node-label');
			label.setAttribute('y', node.kind.includes('folder') ? '24' : '19');
			label.setAttribute('text-anchor', 'middle');
			label.textContent = visibleLabel(node.label);
			group.append(label);
		}

		group.addEventListener('pointerdown', (event) => this.startNodeDrag(event, node));
		group.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				this.options.onNodeActivate(node, new MouseEvent('click'));
			}
		});
		group.addEventListener('pointerenter', () => this.highlightNeighborhood(node.id, true));
		group.addEventListener('pointerleave', () => this.highlightNeighborhood(node.id, false));

		this.nodeLayer.append(group);
		this.nodeElements.set(node.id, group);
	}

	private startNodeDrag(event: PointerEvent, node: MapNode): void {
		if (event.button !== 0 && event.button !== 1) return;
		event.preventDefault();
		event.stopPropagation();
		const position = this.options.positions[node.id];
		if (!position) return;
		const startWorld = this.toWorldPoint(event.clientX, event.clientY);
		this.dragState = {
			node,
			moved: false,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startWorldX: startWorld.x,
			startWorldY: startWorld.y,
			startNodeX: position.x,
			startNodeY: position.y,
		};
		this.svg.setPointerCapture(event.pointerId);
		const onMove = (moveEvent: PointerEvent) => {
			const state = this.dragState;
			if (!state) return;
			if (!state.moved) {
				state.moved = exceedsDragThreshold(
					state.startClientX,
					state.startClientY,
					moveEvent.clientX,
					moveEvent.clientY,
				);
				if (!state.moved) return;
			}
			const point = this.toWorldPoint(moveEvent.clientX, moveEvent.clientY);
			const position = this.options.positions[node.id];
			const element = this.nodeElements.get(node.id);
			if (!position || !element) return;
			position.x = state.startNodeX + point.x - state.startWorldX;
			position.y = state.startNodeY + point.y - state.startWorldY;
			position.fixed = true;
			element.setAttribute('transform', `translate(${position.x} ${position.y})`);
			this.updateConnectedEdges(node.id);
		};
		const onUp = (upEvent: PointerEvent) => {
			cleanup(upEvent.pointerId);
			const state = this.dragState;
			this.dragState = null;
			if (!state) return;
			const position = this.options.positions[node.id];
			if (position && state.moved) {
				this.options.onPositionChange(node.id, { ...position });
			} else {
				this.options.onNodeActivate(node, upEvent);
			}
		};
		const onCancel = (cancelEvent: PointerEvent) => {
			cleanup(cancelEvent.pointerId);
			this.dragState = null;
		};
		const cleanup = (pointerId: number) => {
			this.svg.removeEventListener('pointermove', onMove);
			this.svg.removeEventListener('pointerup', onUp);
			this.svg.removeEventListener('pointercancel', onCancel);
			if (this.svg.hasPointerCapture(pointerId)) this.svg.releasePointerCapture(pointerId);
		};
		this.svg.addEventListener('pointermove', onMove);
		this.svg.addEventListener('pointerup', onUp);
		this.svg.addEventListener('pointercancel', onCancel);
	}

	private bindViewportEvents(): void {
		this.svg.addEventListener('wheel', (event) => {
			event.preventDefault();
			const rect = this.svg.getBoundingClientRect();
			const pointerX = event.clientX - rect.left - rect.width / 2;
			const pointerY = event.clientY - rect.top - rect.height / 2;
			const oldZoom = this.viewport.zoom;
			const newZoom = Math.max(0.25, Math.min(3, oldZoom * Math.exp(-event.deltaY * 0.001)));
			const worldX = (pointerX - this.viewport.x) / oldZoom;
			const worldY = (pointerY - this.viewport.y) / oldZoom;
			this.viewport.x = pointerX - worldX * newZoom;
			this.viewport.y = pointerY - worldY * newZoom;
			this.viewport.zoom = newZoom;
			this.applyViewport();
			this.options.onViewportChange({ ...this.viewport });
		}, { passive: false });

		this.svg.addEventListener('pointerdown', (event) => {
			if (event.target !== this.svg) return;
			this.panStart = {
				x: event.clientX,
				y: event.clientY,
				viewportX: this.viewport.x,
				viewportY: this.viewport.y,
			};
			this.svg.setPointerCapture(event.pointerId);
		});
		this.svg.addEventListener('pointermove', (event) => {
			if (!this.panStart) return;
			this.viewport.x = this.panStart.viewportX + event.clientX - this.panStart.x;
			this.viewport.y = this.panStart.viewportY + event.clientY - this.panStart.y;
			this.applyViewport();
		});
		this.svg.addEventListener('pointerup', (event) => {
			if (!this.panStart) return;
			this.panStart = null;
			this.svg.releasePointerCapture(event.pointerId);
			this.options.onViewportChange({ ...this.viewport });
		});
	}

	private applyViewport(): void {
		if (this.destroyed) return;
		const rect = this.svg.getBoundingClientRect();
		this.world.setAttribute(
			'transform',
			`translate(${rect.width / 2 + this.viewport.x} ${rect.height / 2 + this.viewport.y}) scale(${this.viewport.zoom})`,
		);
	}

	private toWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
		const rect = this.svg.getBoundingClientRect();
		return {
			x: (clientX - rect.left - rect.width / 2 - this.viewport.x) / this.viewport.zoom,
			y: (clientY - rect.top - rect.height / 2 - this.viewport.y) / this.viewport.zoom,
		};
	}

	private updateConnectedEdges(nodeId: string): void {
		for (const edge of this.options.graph.edges) {
			if (edge.from !== nodeId && edge.to !== nodeId) continue;
			const path = this.edgeElements.get(edge.id);
			const from = this.options.positions[edge.from];
			const to = this.options.positions[edge.to];
			if (!path || !from || !to) continue;
			path.setAttribute('d', createEdgePath(edge, from, to));
		}
	}

	private highlightNeighborhood(nodeId: string, active: boolean): void {
		const related = new Set([nodeId]);
		for (const edge of this.options.graph.edges) {
			if (edge.from === nodeId || edge.to === nodeId) {
				related.add(edge.from);
				related.add(edge.to);
				this.edgeElements.get(edge.id)?.toggleClass('is-highlighted', active);
			}
		}
		for (const [id, element] of this.nodeElements) {
			element.toggleClass('is-dimmed', active && !related.has(id));
		}
	}
}
