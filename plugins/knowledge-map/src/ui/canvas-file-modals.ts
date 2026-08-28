import {
	App,
	FuzzySuggestModal,
	Modal,
	Setting,
	TFolder,
} from 'obsidian';

export class CanvasRenameModal extends Modal {
	constructor(
		app: App,
		private readonly initialName: string,
		private readonly onRename: (name: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText('重命名画布');
		let value = this.initialName;
		const setting = new Setting(this.contentEl)
			.setName('画布名称')
			.addText((text) => {
				text.setValue(value).onChange((next) => {
					value = next;
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key !== 'Enter') return;
					event.preventDefault();
					this.submit(value);
				});
				window.setTimeout(() => {
					text.inputEl.focus();
					text.inputEl.select();
				}, 0);
			});
		setting.addButton((button) => button
			.setButtonText('重命名')
			.setCta()
			.onClick(() => this.submit(value)));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private submit(value: string): void {
		this.close();
		this.onRename(value);
	}
}

export class CanvasMoveModal extends FuzzySuggestModal<TFolder> {
	private readonly folders: TFolder[];

	constructor(
		app: App,
		private readonly onMove: (folder: TFolder) => void,
	) {
		super(app);
		this.setPlaceholder('选择目标文件夹');
		const loadedFolders = app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.filter((folder) => folder.path !== '/')
			.sort((left, right) => left.path.localeCompare(right.path));
		this.folders = [app.vault.getRoot(), ...loadedFolders];
	}

	getItems(): TFolder[] {
		return this.folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path === '/' ? '仓库根目录' : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onMove(folder);
	}
}
