import { normalizeFolderPath, remapPath } from '../core/paths';

export class NavigationHistory {
	private entries: string[] = [];
	private index = -1;

	get canBack(): boolean {
		return this.index > 0;
	}

	get canForward(): boolean {
		return this.index >= 0 && this.index < this.entries.length - 1;
	}

	push(path: string): string {
		const normalized = normalizeFolderPath(path);
		if (this.entries[this.index] === normalized) return normalized;
		this.entries = this.entries.slice(0, this.index + 1);
		this.entries.push(normalized);
		this.index = this.entries.length - 1;
		return normalized;
	}

	back(): string | null {
		if (!this.canBack) return null;
		this.index -= 1;
		return this.entries[this.index] ?? null;
	}

	forward(): string | null {
		if (!this.canForward) return null;
		this.index += 1;
		return this.entries[this.index] ?? null;
	}

	migratePath(oldPath: string, newPath: string): void {
		this.entries = this.entries.map((entry) => remapPath(entry, oldPath, newPath));
	}
}
