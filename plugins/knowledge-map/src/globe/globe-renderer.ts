import type { FolderGraph, MapNode } from '../core/graph';
import type { GlobePosition } from '../data/schema';
import { defaultLatLng, GLOBE_RADIUS, latLngToVec3, vec3ToLatLng } from './geo';
import earthCloudsUrl from './textures/earth-clouds.jpg';
import earthDayUrl from './textures/earth-day.jpg';

interface GlobeRendererOptions {
	container: HTMLElement;
	graph: FolderGraph;
	positions: Record<string, GlobePosition>;
	onNodeActivate: (node: MapNode, event: PointerEvent) => void;
	onPositionChange: (nodeId: string, position: GlobePosition) => void;
}

interface LabelEntry {
	node: MapNode;
	element: HTMLButtonElement;
	position: GlobePosition;
}

export class GlobeRenderer {
	private disposed = false;
	private stopAnimation: (() => void) | null = null;

	constructor(private readonly options: GlobeRendererOptions) {}

	async mount(): Promise<void> {
		const THREE = await import('three');
		const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
		if (this.disposed) return;

		const canvas = this.options.container.createEl('canvas', { cls: 'knowledge-map-globe__canvas' });
		const labelsEl = this.options.container.createDiv({ cls: 'knowledge-map-globe__labels' });
		const scene = new THREE.Scene();
		scene.background = new THREE.Color('#040611');
		const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
		camera.position.set(0, 0, 6.4);
		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;

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

		const labels = this.options.graph.nodes
			.filter((node) => node.kind !== 'current-folder')
			.map((node, index) => this.createLabel(node, index, labelsEl, controls, camera, globe, renderer, THREE));
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

	private createStars(THREE: typeof import('three')): import('three').Points {
		const points: number[] = [];
		for (let index = 0; index < 1800; index += 1) {
			const radius = 18 + (index % 23);
			const theta = index * 2.399963;
			const phi = Math.acos(1 - 2 * ((index * 97) % 1800) / 1800);
			points.push(
				radius * Math.sin(phi) * Math.cos(theta),
				radius * Math.cos(phi),
				radius * Math.sin(phi) * Math.sin(theta),
			);
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		return new THREE.Points(
			geometry,
			new THREE.PointsMaterial({ color: '#ffffff', size: 0.035, transparent: true, opacity: 0.75 }),
		);
	}

	private createLabel(
		node: MapNode,
		index: number,
		parent: HTMLElement,
		controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
		camera: import('three').PerspectiveCamera,
		globe: import('three').Mesh,
		renderer: import('three').WebGLRenderer,
		THREE: typeof import('three'),
	): LabelEntry {
		const position = this.options.positions[node.id] ?? defaultLatLng(node.id, index);
		const element = parent.createEl('button', {
			cls: `knowledge-map-globe__label is-${node.kind}`,
			text: node.label,
			attr: { 'aria-label': `${node.label}, ${node.kind}` },
		});
		element.addEventListener('pointerdown', (event) => {
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
		return { node, element, position };
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

