import { setIcon } from 'obsidian';
import type { MapNode } from '../core/graph';
import type { GlobePosition } from '../data/schema';
import type { GlobeNodeSize } from './globe-canvas-document';
import {
	createCustomNodeColorScheme,
	mergeKnowledgeCanvasNodeAppearance,
	type KnowledgeCanvasNodeAppearance,
} from '../integrations/knowledge-canvas-model';
import { defaultLatLng, GLOBE_RADIUS, latLngToVec3, vec3ToLatLng } from './geo';
import earthCloudsUrl from './textures/earth-clouds.jpg';
import earthDayUrl from './textures/earth-day.jpg';

interface GlobeRendererOptions {
	container: HTMLElement;
	nodes: GlobeRenderNode[];
	positions: Record<string, GlobePosition>;
	onNodeActivate: (node: MapNode, event: PointerEvent) => void;
	onNodeContextMenu: (node: MapNode, event: MouseEvent) => void;
	onPositionChange: (nodeId: string, position: GlobePosition) => void;
	onSizeChange: (nodeId: string, size: GlobeNodeSize) => void;
}

export interface GlobeRenderNode extends MapNode {
	appearance?: KnowledgeCanvasNodeAppearance;
	canvasType?: '2d' | '3d';
	size?: GlobeNodeSize;
}

interface LabelEntry {
	node: GlobeRenderNode;
	element: HTMLButtonElement;
	position: GlobePosition;
}

export class GlobeRenderer {
	private disposed = false;
	private stopAnimation: (() => void) | null = null;
	private pointerToPosition: ((clientX: number, clientY: number) => GlobePosition | null) | null = null;
	private focusNodeHandler: ((nodeId: string) => boolean) | null = null;
	private updateAppearanceHandler: ((nodeId: string, appearance: KnowledgeCanvasNodeAppearance) => boolean) | null = null;

	constructor(private readonly options: GlobeRendererOptions) {}

	async mount(): Promise<void> {
		const THREE = await import('three');
		const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
		if (this.disposed) return;

		const canvas = this.options.container.createEl('canvas', { cls: 'knowledge-map-globe__canvas' });
		const labelsEl = this.options.container.createDiv({ cls: 'knowledge-map-globe__labels' });
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
		camera.position.set(0, 0, 6.4);
		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setClearColor(new THREE.Color('#050817'), 0.7);

		const textureLoader = new THREE.TextureLoader();
		const dayTexture = textureLoader.load(earthDayUrl);
		dayTexture.colorSpace = THREE.SRGBColorSpace;
		dayTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		const cloudTexture = textureLoader.load(earthCloudsUrl);
		const globe = new THREE.Mesh(
			new THREE.SphereGeometry(GLOBE_RADIUS, 72, 48),
			new THREE.MeshPhongMaterial({
				map: dayTexture,
				color: '#ffffff',
				emissive: '#071425',
				specular: '#7db4d8',
				shininess: 22,
			}),
		);
		scene.add(globe);
		const clouds = new THREE.Mesh(
			new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 72, 48),
			new THREE.MeshPhongMaterial({
				alphaMap: cloudTexture,
				color: '#ffffff',
				transparent: true,
				opacity: 0.48,
				depthWrite: false,
			}),
		);
		scene.add(clouds);

		const latitudeLines = new THREE.LineSegments(
			new THREE.WireframeGeometry(new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, 36, 18)),
			new THREE.LineBasicMaterial({ color: '#72a9c9', transparent: true, opacity: 0.09 }),
		);
		scene.add(latitudeLines);

		const atmosphere = new THREE.Mesh(
			new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 48, 32),
			new THREE.MeshBasicMaterial({
				color: '#63a9ff',
				transparent: true,
				opacity: 0.08,
				side: THREE.BackSide,
				blending: THREE.AdditiveBlending,
			}),
		);
		scene.add(atmosphere);

		const stars = this.createStars(THREE);
		scene.add(stars);
		scene.add(new THREE.AmbientLight('#a7c7e7', 1.1));
		const light = new THREE.DirectionalLight('#ffffff', 2.2);
		light.position.set(-4, 3, 6);
		scene.add(light);

		const controls = new OrbitControls(camera, canvas);
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.dampingFactor = 0.1;
		controls.rotateSpeed = 0.45;
		controls.zoomSpeed = 0.8;
		controls.minDistance = 3.2;
		controls.maxDistance = 14;
		this.pointerToPosition = (clientX, clientY) => {
			return this.raycastGlobe(clientX, clientY, camera, globe, renderer, THREE);
		};

		const labels = this.options.nodes
			.filter((node) => node.kind !== 'current-folder')
			.map((node, index) => this.createLabel(node, index, labelsEl, controls, camera, globe, renderer, THREE));
		this.focusNodeHandler = (nodeId) => {
			const label = labels.find((entry) => entry.node.id === nodeId);
			if (!label) return false;
			const distance = camera.position.length();
			const raw = latLngToVec3(label.position.lat, label.position.lng, distance);
			camera.position.set(raw.x, raw.y, raw.z);
			camera.lookAt(0, 0, 0);
			controls.target.set(0, 0, 0);
			controls.update();
			return true;
		};
		this.updateAppearanceHandler = (nodeId, appearance) => {
			const label = labels.find((entry) => entry.node.id === nodeId);
			if (!label) return false;
			label.node.appearance = mergeKnowledgeCanvasNodeAppearance(appearance);
			this.applyLabelAppearance(label);
			return true;
		};
		const resize = () => {
			const width = Math.max(1, this.options.container.clientWidth);
			const height = Math.max(1, this.options.container.clientHeight);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		};
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(this.options.container);
		resize();

		let animationFrame = 0;
		const animate = () => {
			if (this.disposed) return;
			controls.update();
			clouds.rotation.y += 0.00008;
			this.positionLabels(labels, camera, this.options.container, THREE);
			renderer.render(scene, camera);
			animationFrame = window.requestAnimationFrame(animate);
		};
		animate();

		this.stopAnimation = () => {
			this.pointerToPosition = null;
			this.focusNodeHandler = null;
			this.updateAppearanceHandler = null;
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			controls.dispose();
			globe.geometry.dispose();
			(globe.material as InstanceType<typeof THREE.Material>).dispose();
			clouds.geometry.dispose();
			(clouds.material as InstanceType<typeof THREE.Material>).dispose();
			dayTexture.dispose();
			cloudTexture.dispose();
			latitudeLines.geometry.dispose();
			(latitudeLines.material as InstanceType<typeof THREE.Material>).dispose();
			atmosphere.geometry.dispose();
			(atmosphere.material as InstanceType<typeof THREE.Material>).dispose();
			stars.geometry.dispose();
			(stars.material as InstanceType<typeof THREE.Material>).dispose();
			renderer.dispose();
			canvas.remove();
			labelsEl.remove();
		};
	}

	destroy(): void {
		this.disposed = true;
		this.stopAnimation?.();
		this.stopAnimation = null;
	}

	positionAt(clientX: number, clientY: number): GlobePosition | null {
		return this.pointerToPosition?.(clientX, clientY) ?? null;
	}

	focusNode(nodeId: string): boolean {
		return this.focusNodeHandler?.(nodeId) ?? false;
	}

	updateNodeAppearance(nodeId: string, appearance: KnowledgeCanvasNodeAppearance): boolean {
		return this.updateAppearanceHandler?.(nodeId, appearance) ?? false;
	}

	private createStars(THREE: typeof import('three')): import('three').Points {
		const points: number[] = [];
		const colors: number[] = [];
		const palette = ['#ffffff', '#b9d8ff', '#d8c9ff', '#ffe6bd'];
		for (let index = 0; index < 2400; index += 1) {
			const radius = 14 + (index % 31);
			const theta = index * 2.399963;
			const phi = Math.acos(1 - 2 * ((index * 97) % 2400) / 2400);
			points.push(
				radius * Math.sin(phi) * Math.cos(theta),
				radius * Math.cos(phi),
				radius * Math.sin(phi) * Math.sin(theta),
			);
			const color = new THREE.Color(palette[index % palette.length]);
			colors.push(color.r, color.g, color.b);
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		return new THREE.Points(
			geometry,
			new THREE.PointsMaterial({
				size: 0.065,
				transparent: true,
				opacity: 0.92,
				vertexColors: true,
				depthWrite: false,
			}),
		);
	}

	private createLabel(
		node: GlobeRenderNode,
		index: number,
		parent: HTMLElement,
		controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
		camera: import('three').PerspectiveCamera,
		globe: import('three').Mesh,
		renderer: import('three').WebGLRenderer,
		THREE: typeof import('three'),
	): LabelEntry {
		const position = this.options.positions[node.id] ?? defaultLatLng(node.id, index);
		const kindLabel = node.kind === 'folder'
			? '文件夹'
			: node.kind === 'current-folder'
				? '当前文件夹'
				: node.kind === 'external-note' ? '外部笔记' : '笔记';
		const element = parent.createEl('button', {
			cls: `knowledge-map-globe__label is-${node.kind}`,
			attr: { 'aria-label': `${node.label}，${kindLabel}` },
		});
		const icon = element.createSpan({ cls: 'knowledge-map-globe__label-icon' });
		icon.createSpan({ cls: 'knowledge-map-globe__label-icon-glyph' });
		element.createSpan({ cls: 'knowledge-map-globe__label-text', text: node.label });
		const entry = { node, element, position };
		this.applyLabelAppearance(entry);
		this.applyLabelSize(entry);
		for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
			const resizeHandle = element.createSpan({
				cls: `knowledge-map-globe__label-resize is-${edge}`,
				attr: { 'aria-label': `拖动${edge === 'top' ? '上' : edge === 'right' ? '右' : edge === 'bottom' ? '下' : '左'}边调整大小` },
			});
			resizeHandle.addEventListener('pointerdown', (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.stopPropagation();
				controls.enabled = false;
				const startX = event.clientX;
				const startY = event.clientY;
				const startSize = entry.node.size ?? this.defaultNodeSize(entry.node);
				let latest = startSize;
				const move = (moveEvent: PointerEvent): void => {
					const horizontalDelta = (edge === 'left' ? -1 : 1) * (moveEvent.clientX - startX);
					const verticalDelta = (edge === 'top' ? -1 : 1) * (moveEvent.clientY - startY);
					latest = {
						width: edge === 'left' || edge === 'right'
							? Math.max(72, Math.min(320, startSize.width + horizontalDelta))
							: startSize.width,
						height: edge === 'top' || edge === 'bottom'
							? Math.max(36, Math.min(140, startSize.height + verticalDelta))
							: startSize.height,
					};
					entry.node.size = latest;
					this.applyLabelSize(entry);
				};
				const up = (): void => {
					window.removeEventListener('pointermove', move);
					window.removeEventListener('pointerup', up);
					controls.enabled = true;
					this.options.onSizeChange(node.id, latest);
				};
				window.addEventListener('pointermove', move);
				window.addEventListener('pointerup', up);
			});
		}
		element.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();
			controls.enabled = false;
			const startX = event.clientX;
			const startY = event.clientY;
			let moved = false;
			let latest = position;
			const move = (moveEvent: PointerEvent) => {
				moved ||= Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5;
				if (!moved) return;
				const hit = this.raycastGlobe(moveEvent.clientX, moveEvent.clientY, camera, globe, renderer, THREE);
				if (hit) {
					latest = hit;
					position.lat = hit.lat;
					position.lng = hit.lng;
				}
			};
			const up = (upEvent: PointerEvent) => {
				window.removeEventListener('pointermove', move);
				window.removeEventListener('pointerup', up);
				controls.enabled = true;
				if (moved) this.options.onPositionChange(node.id, latest);
				else this.options.onNodeActivate(node, upEvent);
			};
			window.addEventListener('pointermove', move);
			window.addEventListener('pointerup', up);
		});
		element.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.options.onNodeContextMenu(node, event);
		});
		return entry;
	}

	private applyLabelAppearance(entry: LabelEntry): void {
		const appearance = mergeKnowledgeCanvasNodeAppearance(entry.node.appearance);
		const colors = this.nodeColors(entry.node, appearance);
		entry.element.style.setProperty('--knowledge-map-globe-node-accent', colors.stroke);
		entry.element.style.setProperty('--knowledge-map-globe-node-background', colors.background);
		entry.element.style.setProperty('--knowledge-map-globe-node-text', colors.text);
		entry.element.removeClass('is-shape-ellipse', 'is-shape-rounded', 'is-shape-rectangle', 'is-shape-diamond');
		entry.element.addClass(`is-shape-${appearance.shape}`);
		entry.element.toggleClass('is-canvas-2d', entry.node.canvasType === '2d');
		entry.element.toggleClass('is-canvas-3d', entry.node.canvasType === '3d');
		const iconShell = entry.element.querySelector<HTMLElement>('.knowledge-map-globe__label-icon');
		const glyph = entry.element.querySelector<HTMLElement>('.knowledge-map-globe__label-icon-glyph');
		if (!iconShell || !glyph) return;
		glyph.empty();
		glyph.removeClass('is-emoji');
		iconShell.toggleClass('is-hidden', appearance.icon.kind === 'none');
		if (appearance.icon.kind === 'none') return;
		if (appearance.icon.kind === 'lucide' && appearance.icon.value) {
			setIcon(glyph, appearance.icon.value);
			return;
		}
		if (appearance.icon.kind === 'emoji' || appearance.icon.kind === 'symbol' || appearance.icon.kind === 'text') {
			glyph.setText(appearance.icon.value ?? '');
			glyph.toggleClass('is-emoji', appearance.icon.kind === 'emoji');
			return;
		}
		setIcon(glyph, entry.node.canvasType === '3d'
			? 'globe-2'
			: entry.node.canvasType === '2d'
				? 'network'
				: entry.node.kind === 'folder' ? 'folder' : 'file-text');
	}

	private applyLabelSize(entry: LabelEntry): void {
		const size = entry.node.size ?? this.defaultNodeSize(entry.node);
		entry.element.style.setProperty('--knowledge-map-globe-node-width', `${size.width}px`);
		entry.element.style.setProperty('--knowledge-map-globe-node-height', `${size.height}px`);
	}

	private defaultNodeSize(node: GlobeRenderNode): GlobeNodeSize {
		const estimatedWidth = 58 + Array.from(node.label).reduce((width, character) => {
			return width + ((character.codePointAt(0) ?? 0) > 0xff ? 13 : 7.2);
		}, 0);
		return { width: Math.round(Math.max(96, Math.min(220, estimatedWidth))), height: 44 };
	}

	private nodeColors(
		node: GlobeRenderNode,
		appearance: KnowledgeCanvasNodeAppearance,
	): { stroke: string; background: string; text: string } {
		if (appearance.palette === 'custom') {
			return createCustomNodeColorScheme(appearance.customColor ?? '')
				?? { stroke: '#58708f', background: '#e8eef5', text: '#26384d' };
		}
		if (appearance.palette === 'default') {
			if (node.canvasType === '3d') return { stroke: '#4b8fc9', background: '#e8f4ff', text: '#244b68' };
			if (node.canvasType === '2d') return { stroke: '#8066b3', background: '#f1edfb', text: '#43345f' };
			if (node.kind === 'folder') return { stroke: '#c7862f', background: '#fff2d2', text: '#4d3b22' };
			return { stroke: '#4c86b7', background: '#eaf4fd', text: '#293f55' };
		}
		switch (appearance.palette) {
			case 'amber': return { stroke: '#b47718', background: '#fff1cf', text: '#68450f' };
			case 'black': return { stroke: '#242629', background: '#e7e8ea', text: '#202225' };
			case 'blue': return { stroke: '#4b82b5', background: '#eaf4ff', text: '#294e70' };
			case 'brown': return { stroke: '#805d46', background: '#f4ece7', text: '#513b2d' };
			case 'cyan': return { stroke: '#258fa3', background: '#e3f7fa', text: '#245c67' };
			case 'gray': return { stroke: '#717984', background: '#eef0f2', text: '#454b53' };
			case 'green': return { stroke: '#4f8b68', background: '#eaf6ee', text: '#315a43' };
			case 'indigo': return { stroke: '#5368b5', background: '#eceffd', text: '#354476' };
			case 'lime': return { stroke: '#739f32', background: '#f0f7df', text: '#465f22' };
			case 'magenta': return { stroke: '#a94faa', background: '#f8eaf8', text: '#653066' };
			case 'orange': return { stroke: '#c77d2f', background: '#fff3d8', text: '#6d4826' };
			case 'pink': return { stroke: '#c96590', background: '#fbeaf1', text: '#763d58' };
			case 'purple': return { stroke: '#8066b3', background: '#f1edfb', text: '#493969' };
			case 'red': return { stroke: '#b85c62', background: '#fbecee', text: '#71383d' };
			case 'rose': return { stroke: '#b94f68', background: '#fbe9ee', text: '#713243' };
			case 'teal': return { stroke: '#278a78', background: '#e3f5f1', text: '#24594f' };
			case 'violet': return { stroke: '#7d5bb5', background: '#f1ebfa', text: '#4b376d' };
			case 'yellow': return { stroke: '#b68c13', background: '#fff5c9', text: '#68520f' };
		}
	}

	private raycastGlobe(
		clientX: number,
		clientY: number,
		camera: import('three').PerspectiveCamera,
		globe: import('three').Mesh,
		renderer: import('three').WebGLRenderer,
		THREE: typeof import('three'),
	): GlobePosition | null {
		const rect = renderer.domElement.getBoundingClientRect();
		const pointer = new THREE.Vector2(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1,
		);
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObject(globe, false)[0];
		return hit ? vec3ToLatLng(hit.point) : null;
	}

	private positionLabels(
		labels: LabelEntry[],
		camera: import('three').PerspectiveCamera,
		container: HTMLElement,
		THREE: typeof import('three'),
	): void {
		const cameraPosition = camera.position;
		for (const label of labels) {
			const raw = latLngToVec3(label.position.lat, label.position.lng, GLOBE_RADIUS * 1.06);
			const point = new THREE.Vector3(raw.x, raw.y, raw.z);
			const surface = latLngToVec3(label.position.lat, label.position.lng, GLOBE_RADIUS);
			const visible = surface.x * cameraPosition.x + surface.y * cameraPosition.y + surface.z * cameraPosition.z
				> GLOBE_RADIUS * GLOBE_RADIUS;
			label.element.toggleClass('is-hidden', !visible);
			if (!visible) continue;
			point.project(camera);
			const x = (point.x * 0.5 + 0.5) * container.clientWidth;
			const y = (-point.y * 0.5 + 0.5) * container.clientHeight;
			label.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
		}
	}
}

