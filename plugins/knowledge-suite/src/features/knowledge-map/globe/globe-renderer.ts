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
import jupiterVoyagerUrl from './textures/jupiter-voyager.jpg';
import marsVikingUrl from './textures/mars-viking.jpg';
import mercuryMarinerUrl from './textures/mercury-mariner.jpg';
import moonLroUrl from './textures/moon-lro-1280.jpg';
import neptuneJplUrl from './textures/neptune-jpl.jpg';
import saturnJplUrl from './textures/saturn-jpl.jpg';
import uranusJplUrl from './textures/uranus-jpl.jpg';
import venusMagellanUrl from './textures/venus-magellan.jpg';

interface GlobeRendererOptions {
	container: HTMLElement;
	nodes: GlobeRenderNode[];
	positions: Record<string, GlobePosition>;
	onNodeActivate: (node: MapNode, event: PointerEvent) => void;
	onNodeContextMenu: (node: MapNode, event: MouseEvent) => void;
	onPositionChange: (nodeId: string, position: GlobePosition) => void;
	onSizeChange: (nodeId: string, size: GlobeNodeSize) => void;
	onSelectionChange: (nodeIds: readonly string[]) => void;
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

interface SolarSystemDecoration {
	group: import('three').Group;
	update: () => void;
	dispose: () => void;
}

export class GlobeRenderer {
	private disposed = false;
	private stopAnimation: (() => void) | null = null;
	private pointerToPosition: ((clientX: number, clientY: number) => GlobePosition | null) | null = null;
	private focusNodeHandler: ((nodeId: string) => boolean) | null = null;
	private updateAppearanceHandler: ((nodeId: string, appearance: KnowledgeCanvasNodeAppearance) => boolean) | null = null;
	private spacePressed = false;

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
		renderer.setClearColor(new THREE.Color('#01030a'), 0.58);

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

		const solarSystem = this.createSolarSystem(THREE, textureLoader, renderer);
		scene.add(solarSystem.group);

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
		const stopMarqueeSelection = this.setupMarqueeSelection(canvas, labels);
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
			solarSystem.update();
			stars.rotation.y += 0.000012;
			this.positionLabels(labels, camera, this.options.container, THREE);
			renderer.render(scene, camera);
			animationFrame = window.requestAnimationFrame(animate);
		};
		animate();

		this.stopAnimation = () => {
			this.pointerToPosition = null;
			this.focusNodeHandler = null;
			this.updateAppearanceHandler = null;
			stopMarqueeSelection();
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
			solarSystem.dispose();
			stars.geometry.dispose();
			(stars.material as import('three').PointsMaterial).map?.dispose();
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

	setSpacePressed(pressed: boolean): void {
		this.spacePressed = pressed;
		this.options.container.toggleClass('is-space-pressed', pressed);
	}

	private setupMarqueeSelection(canvas: HTMLCanvasElement, labels: readonly LabelEntry[]): () => void {
		const selectionEl = this.options.container.createDiv({ cls: 'knowledge-map-globe__selection-box' });
		let selecting = false;
		let startX = 0;
		let startY = 0;

		const applySelection = (left: number, top: number, right: number, bottom: number): string[] => {
			const selectedIds: string[] = [];
			for (const label of labels) {
				const rect = label.element.getBoundingClientRect();
				const selected = !label.element.hasClass('is-hidden')
					&& rect.right >= left
					&& rect.left <= right
					&& rect.bottom >= top
					&& rect.top <= bottom;
				label.element.toggleClass('is-selected', selected);
				if (selected) selectedIds.push(label.node.id);
			}
			return selectedIds;
		};

		const move = (event: PointerEvent): void => {
			if (!selecting) return;
			const containerRect = this.options.container.getBoundingClientRect();
			const currentX = Math.max(containerRect.left, Math.min(containerRect.right, event.clientX));
			const currentY = Math.max(containerRect.top, Math.min(containerRect.bottom, event.clientY));
			const left = Math.min(startX, currentX);
			const top = Math.min(startY, currentY);
			const right = Math.max(startX, currentX);
			const bottom = Math.max(startY, currentY);
			selectionEl.style.left = `${left - containerRect.left}px`;
			selectionEl.style.top = `${top - containerRect.top}px`;
			selectionEl.style.width = `${right - left}px`;
			selectionEl.style.height = `${bottom - top}px`;
			selectionEl.toggleClass('is-visible', right - left > 2 || bottom - top > 2);
			applySelection(left, top, right, bottom);
		};

		const finish = (event: PointerEvent): void => {
			if (!selecting) return;
			move(event);
			selecting = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', finish);
			this.options.container.removeClass('is-selecting');
			selectionEl.removeClass('is-visible');
			const selectedIds = labels
				.filter((label) => label.element.hasClass('is-selected'))
				.map((label) => label.node.id);
			this.options.onSelectionChange(selectedIds);
		};

		const start = (event: PointerEvent): void => {
			if (event.button !== 0 || this.spacePressed) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			selecting = true;
			startX = event.clientX;
			startY = event.clientY;
			selectionEl.style.left = `${event.offsetX}px`;
			selectionEl.style.top = `${event.offsetY}px`;
			for (const label of labels) label.element.removeClass('is-selected');
			this.options.container.addClass('is-selecting');
			window.addEventListener('pointermove', move);
			window.addEventListener('pointerup', finish);
		};

		canvas.addEventListener('pointerdown', start, true);
		return () => {
			canvas.removeEventListener('pointerdown', start, true);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', finish);
			selectionEl.remove();
			this.options.container.removeClass('is-selecting', 'is-space-pressed');
		};
	}

	private createSolarSystem(
		THREE: typeof import('three'),
		textureLoader: import('three').TextureLoader,
		renderer: import('three').WebGLRenderer,
	): SolarSystemDecoration {
		const group = new THREE.Group();
		const textures: import('three').Texture[] = [];
		const geometries: import('three').BufferGeometry[] = [];
		const materials: import('three').Material[] = [];
		const rotating: Array<{ mesh: import('three').Object3D; speed: number }> = [];
		const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		const loadTexture = (url: string): import('three').Texture => {
			const texture = textureLoader.load(url);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = maxAnisotropy;
			textures.push(texture);
			return texture;
		};
		const addPlanet = (
			url: string,
			radius: number,
			position: readonly [number, number, number],
			rotation: readonly [number, number, number],
			speed: number,
			roughness = 0.92,
		): import('three').Mesh => {
			const geometry = new THREE.SphereGeometry(radius, 48, 32);
			const material = new THREE.MeshStandardMaterial({
				map: loadTexture(url),
				roughness,
				metalness: 0,
			});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(...position);
			mesh.rotation.set(...rotation);
			geometries.push(geometry);
			materials.push(material);
			rotating.push({ mesh, speed });
			group.add(mesh);
			return mesh;
		};
		const addAtmosphere = (
			planet: import('three').Mesh,
			radius: number,
			color: string,
			opacity: number,
		): void => {
			const geometry = new THREE.SphereGeometry(radius, 40, 28);
			const material = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity,
				side: THREE.BackSide,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			});
			const atmosphere = new THREE.Mesh(geometry, material);
			atmosphere.position.copy(planet.position);
			geometries.push(geometry);
			materials.push(material);
			group.add(atmosphere);
		};

		// NASA radius ratios and orbital distances are compressed non-linearly so the complete
		// system remains legible around the interactive Earth while preserving real ordering.
		const compressedRadius = (earthRadiusRatio: number): number => 0.18 + 0.33 * Math.sqrt(earthRadiusRatio);
		const backgroundPlanetScale = 0.25;
		const compressedDistance = (astronomicalUnits: number): number => 6.7 + 8.7 * Math.log1p(astronomicalUnits);
		const atOrbitalDistance = (
			astronomicalUnits: number,
			direction: readonly [number, number, number],
		): [number, number, number] => {
			const length = Math.hypot(...direction);
			const distance = compressedDistance(astronomicalUnits);
			return direction.map((component) => (component / length) * distance) as [number, number, number];
		};

		addPlanet(moonLroUrl, 0.52, [-3.2, 1.1, -2.2], [0.08, -0.6, -0.08], 0.000025, 1);
		addPlanet(
			mercuryMarinerUrl,
			compressedRadius(0.383) * backgroundPlanetScale,
			atOrbitalDistance(0.387, [0.86, 0.38, -0.34]),
			[0.04, 0.3, 0.02],
			0.000018,
			1,
		);
		const venusRadius = compressedRadius(0.949) * backgroundPlanetScale;
		const venus = addPlanet(
			venusMagellanUrl,
			venusRadius,
			atOrbitalDistance(0.723, [-0.72, -0.32, 0.62]),
			[0.03, -0.5, 0.05],
			-0.000012,
			0.98,
		);
		addAtmosphere(venus, venusRadius * 1.065, '#e7bc76', 0.075);
		const marsRadius = compressedRadius(0.532) * backgroundPlanetScale;
		const mars = addPlanet(
			marsVikingUrl,
			marsRadius,
			atOrbitalDistance(1.524, [0.25, 0.83, -0.5]),
			[0.14, 0.7, 0.16],
			0.000055,
			0.96,
		);
		addAtmosphere(mars, marsRadius * 1.045, '#d88766', 0.05);
		addPlanet(
			jupiterVoyagerUrl,
			compressedRadius(11.21) * backgroundPlanetScale,
			atOrbitalDistance(5.203, [-0.58, 0.3, -0.76]),
			[0.04, -0.2, -0.05],
			0.00013,
			0.86,
		);
		const saturnRadius = compressedRadius(9.45) * backgroundPlanetScale;
		const saturn = addPlanet(
			saturnJplUrl,
			saturnRadius,
			atOrbitalDistance(9.537, [0.66, -0.68, -0.32]),
			[0.06, 0.4, 0.24],
			0.00011,
			0.88,
		);
		addPlanet(
			uranusJplUrl,
			compressedRadius(4.01) * backgroundPlanetScale,
			atOrbitalDistance(19.19, [-0.26, 0.55, 0.79]),
			[0.1, 0.2, 1.42],
			-0.000075,
			0.84,
		);
		addPlanet(
			neptuneJplUrl,
			compressedRadius(3.88) * backgroundPlanetScale,
			atOrbitalDistance(30.07, [0.22, -0.78, -0.59]),
			[0.12, -0.3, 0.46],
			0.00008,
			0.82,
		);

		const ringGeometry = new THREE.RingGeometry(saturnRadius * 1.24, saturnRadius * 2.23, 128);
		const ringTexture = this.createSaturnRingTexture(THREE);
		textures.push(ringTexture);
		const ringMaterial = new THREE.MeshBasicMaterial({
			map: ringTexture,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.position.copy(saturn.position);
		ring.rotation.set(Math.PI * 0.44, 0.08, 0.27);
		geometries.push(ringGeometry);
		materials.push(ringMaterial);
		group.add(ring);

		return {
			group,
			update: () => {
				for (const body of rotating) body.mesh.rotation.y += body.speed;
			},
			dispose: () => {
				for (const geometry of geometries) geometry.dispose();
				for (const material of materials) material.dispose();
				for (const texture of textures) texture.dispose();
				group.clear();
			},
		};
	}

	private createSaturnRingTexture(THREE: typeof import('three')): import('three').CanvasTexture {
		const canvas = createEl('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const context = canvas.getContext('2d');
		if (context) {
			const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
			gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
			gradient.addColorStop(0.53, 'rgba(255, 255, 255, 0)');
			gradient.addColorStop(0.555, 'rgba(177, 155, 121, 0.34)');
			gradient.addColorStop(0.61, 'rgba(232, 216, 183, 0.8)');
			gradient.addColorStop(0.67, 'rgba(154, 136, 108, 0.52)');
			gradient.addColorStop(0.72, 'rgba(42, 35, 29, 0.16)');
			gradient.addColorStop(0.75, 'rgba(232, 218, 187, 0.86)');
			gradient.addColorStop(0.82, 'rgba(185, 164, 130, 0.64)');
			gradient.addColorStop(0.91, 'rgba(228, 211, 178, 0.46)');
			gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
			context.fillStyle = gradient;
			context.fillRect(0, 0, 512, 512);
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
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
				size: 0.105,
				map: this.createStarTexture(THREE),
				transparent: true,
				opacity: 0.88,
				vertexColors: true,
				depthWrite: false,
				alphaTest: 0.025,
				blending: THREE.AdditiveBlending,
			}),
		);
	}

	private createStarTexture(THREE: typeof import('three')): import('three').CanvasTexture {
		const canvas = createEl('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const context = canvas.getContext('2d');
		if (context) {
			const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
			gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
			gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.96)');
			gradient.addColorStop(0.34, 'rgba(205, 225, 255, 0.48)');
			gradient.addColorStop(1, 'rgba(155, 195, 255, 0)');
			context.fillStyle = gradient;
			context.fillRect(0, 0, 64, 64);
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
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

