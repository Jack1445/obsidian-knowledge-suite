export const GLOBE_RADIUS = 2;

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const FALLBACK_LATITUDES = [16, -16, 28, -28, 4, 22];

export interface LatLng {
	lat: number;
	lng: number;
}

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export function latLngToVec3(lat: number, lng: number, radius = GLOBE_RADIUS): Vec3 {
	const phi = (90 - lat) * DEGREES_TO_RADIANS;
	const theta = (lng + 180) * DEGREES_TO_RADIANS;
	return {
		x: -(radius * Math.sin(phi) * Math.cos(theta)),
		y: radius * Math.cos(phi),
		z: radius * Math.sin(phi) * Math.sin(theta),
	};
}

export function vec3ToLatLng(vector: Vec3): LatLng {
	const radius = Math.hypot(vector.x, vector.y, vector.z) || 1;
	const lat = 90 - Math.acos(Math.max(-1, Math.min(1, vector.y / radius))) * RADIANS_TO_DEGREES;
	let lng = Math.atan2(vector.z, -vector.x) * RADIANS_TO_DEGREES - 180;
	lng = ((((lng + 180) % 360) + 360) % 360) - 180;
	return { lat, lng };
}

function hash(value: string): number {
	let result = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
}

export function defaultLatLng(id: string, index: number): LatLng {
	const hashedIndex = hash(id) + index;
	return {
		lat: FALLBACK_LATITUDES[hashedIndex % FALLBACK_LATITUDES.length] ?? 0,
		// Keep never-positioned nodes on the camera-facing hemisphere initially.
		// Once dragged, their actual latitude/longitude is persisted instead.
		lng: -130 + ((hashedIndex * 67) % 80),
	};
}
