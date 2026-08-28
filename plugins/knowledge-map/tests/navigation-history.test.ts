import { describe, expect, it } from 'vitest';
import { NavigationHistory } from '../src/services/navigation-history';

describe('NavigationHistory', () => {
	it('moves backward and forward without adding duplicate consecutive entries', () => {
		const history = new NavigationHistory();
		history.push('/');
		history.push('Projects');
		history.push('Projects');
		expect(history.back()).toBe('/');
		expect(history.forward()).toBe('Projects');
	});

	it('drops forward history after a new navigation', () => {
		const history = new NavigationHistory();
		history.push('/');
		history.push('Projects');
		history.back();
		history.push('Archive');
		expect(history.canForward).toBe(false);
	});

	it('migrates renamed folder paths in history', () => {
		const history = new NavigationHistory();
		history.push('Projects/Maps');
		history.push('Projects/Maps/Ideas');
		history.migratePath('Projects/Maps', 'Projects/Knowledge');
		expect(history.back()).toBe('Projects/Knowledge');
		expect(history.forward()).toBe('Projects/Knowledge/Ideas');
	});
});
