import { describe, expect, it } from 'vitest';
import { defaultLatLng, latLngToVec3, vec3ToLatLng } from '../src/globe/geo';

describe('globe coordinates', () => {
	it('round-trips latitude and longitude', () => {
		const original = { lat: 35, lng: 105 };
		const result = vec3ToLatLng(latLngToVec3(original.lat, original.lng));
		expect(result.lat).toBeCloseTo(original.lat, 6);
		expect(result.lng).toBeCloseTo(original.lng, 6);
	});

	it('uses deterministic fallback positions', () => {
		expect(defaultLatLng('note:Projects/Map.md', 3)).toEqual(defaultLatLng('note:Projects/Map.md', 3));
	});

	it('places fallback positions on the initial camera-facing hemisphere', () => {
		for (let index = 0; index < 20; index += 1) {
			const position = defaultLatLng(`note:${index}`, index);
			expect(latLngToVec3(position.lat, position.lng).z).toBeGreaterThan(0);
			expect(position.lng).toBeGreaterThanOrEqual(-130);
			expect(position.lng).toBeLessThan(-50);
		}
	});
});
