import { describe, expect, it } from 'vitest';
import { folderDisplayName, normalizeFolderPath, parentFolderPath, remapPath } from '../src/core/paths';

describe('folder paths', () => {
	it('normalizes vault root and separators', () => {
		expect(normalizeFolderPath('')).toBe('/');
		expect(normalizeFolderPath('/Projects/Maps/')).toBe('Projects/Maps');
	});

	it('finds parents and display names', () => {
		expect(parentFolderPath('/')).toBeNull();
		expect(parentFolderPath('Projects')).toBe('/');
		expect(parentFolderPath('Projects/Maps')).toBe('Projects');
		expect(folderDisplayName('/')).toBe('Vault');
		expect(folderDisplayName('Projects/Maps')).toBe('Maps');
	});

	it('remaps descendants after folder rename', () => {
		expect(remapPath('Projects/Maps/Notes', 'Projects/Maps', 'Projects/Knowledge')).toBe(
			'Projects/Knowledge/Notes',
		);
		expect(remapPath('Archive', 'Projects/Maps', 'Projects/Knowledge')).toBe('Archive');
	});
});
