import { App, TFile, TFolder } from 'obsidian';
import {
	compareMapNodes,
	createContainmentEdges,
	nodeId,
	ROOT_PATH,
	type FolderGraph,
	type MapEdge,
	type MapNode,
} from '../core/graph';
import { folderDisplayName, normalizeFolderPath } from '../core/paths';

export class VaultGraphBuilder {
	constructor(private readonly app: App) {}

	build(folderPath: string, showExternalLinks: boolean): FolderGraph {
		const normalizedPath = normalizeFolderPath(folderPath);
		const folder = this.getFolder(normalizedPath);
		const nodes: MapNode[] = [];
		const edges: MapEdge[] = [];

		let currentFolderNode: MapNode | null = null;
		// The vault root is a navigation context, not a visible graph node.
		if (normalizedPath !== ROOT_PATH) {
			currentFolderNode = {
				id: nodeId('current-folder', normalizedPath),
				path: normalizedPath,
				label: folderDisplayName(normalizedPath),
				kind: 'current-folder',
			};
			nodes.push(currentFolderNode);
		}

		const directChildren: MapNode[] = [];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				directChildren.push({
					id: nodeId('folder', child.path),
					path: child.path,
					label: child.name,
					kind: 'folder',
				});
			} else if (child instanceof TFile && child.extension === 'md') {
				directChildren.push({
					id: nodeId('note', child.path),
					path: child.path,
					label: child.basename,
					kind: 'note',
				});
			}
		}
		directChildren.sort(compareMapNodes);
		nodes.push(...directChildren);
		if (currentFolderNode) edges.push(...createContainmentEdges(currentFolderNode, directChildren));

		const visibleNotes = new Map(
			nodes.filter((node) => node.kind === 'note').map((node) => [node.path, node]),
		);
		const externalNodes = new Map<string, MapNode>();

		for (const source of visibleNotes.values()) {
			const destinations = this.app.metadataCache.resolvedLinks[source.path] ?? {};
			for (const [targetPath, weight] of Object.entries(destinations)) {
				let target = visibleNotes.get(targetPath);
				if (!target && showExternalLinks) {
					const targetFile = this.app.vault.getFileByPath(targetPath);
					if (targetFile?.extension === 'md') {
						target = externalNodes.get(targetPath) ?? {
							id: nodeId('external-note', targetPath),
							path: targetPath,
							label: targetFile.basename,
							kind: 'external-note',
						};
						externalNodes.set(targetPath, target);
					}
				}
				if (target) {
					edges.push({
						id: `link:${source.path}->${target.path}`,
						from: source.id,
						to: target.id,
						kind: 'link',
						weight,
					});
				}
			}
		}

		nodes.push(...[...externalNodes.values()].sort(compareMapNodes));
		return { folderPath: normalizedPath, nodes, edges };
	}

	private getFolder(path: string): TFolder {
		if (path === ROOT_PATH) return this.app.vault.getRoot();
		return this.app.vault.getFolderByPath(path) ?? this.app.vault.getRoot();
	}
}
