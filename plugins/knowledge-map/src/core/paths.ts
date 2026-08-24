import { ROOT_PATH } from './graph';

export function normalizeFolderPath(path: string): string {
	const normalized = path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
	return normalized.length === 0 ? ROOT_PATH : normalized;
}

export function parentFolderPath(path: string): string | null {
	const normalized = normalizeFolderPath(path);
	if (normalized === ROOT_PATH) return null;
	const separator = normalized.lastIndexOf('/');
	return separator < 0 ? ROOT_PATH : normalized.slice(0, separator);
}

export function folderDisplayName(path: string): string {
	const normalized = normalizeFolderPath(path);
	if (normalized === ROOT_PATH) return '仓库';
	return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function pathStartsWithFolder(path: string, folderPath: string): boolean {
	const folder = normalizeFolderPath(folderPath);
	return folder === ROOT_PATH || path === folder || path.startsWith(`${folder}/`);
}

export function remapPath(path: string, oldPath: string, newPath: string): string {
	const oldFolder = normalizeFolderPath(oldPath);
	const newFolder = normalizeFolderPath(newPath);
	if (path === oldFolder) return newFolder;
	if (!pathStartsWithFolder(path, oldFolder)) return path;
	return `${newFolder}${path.slice(oldFolder.length)}`;
}
