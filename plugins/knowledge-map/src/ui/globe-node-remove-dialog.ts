import { Modal, setIcon, type App } from 'obsidian';

export class GlobeNodeRemoveDialog extends Modal {
	constructor(
		app: App,
		private readonly labels: readonly string[],
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('knowledge-map-globe-remove-dialog');
		this.titleEl.setText(this.labels.length === 1 ? '从本画布移除' : `移除 ${this.labels.length} 个节点`);
		const summary = this.contentEl.createDiv({ cls: 'knowledge-map-globe-remove-dialog__summary' });
		const icon = summary.createSpan({ cls: 'knowledge-map-globe-remove-dialog__icon' });
		setIcon(icon, 'circle-minus');
		const copy = summary.createDiv({ cls: 'knowledge-map-globe-remove-dialog__copy' });
		copy.createEl('p', {
			text: this.labels.length === 1
				? `确定从当前3维画布移除“${this.labels[0]}”吗？`
				: `确定从当前3维画布移除选中的 ${this.labels.length} 个节点吗？`,
		});
		copy.createEl('p', {
			cls: 'knowledge-map-globe-remove-dialog__note',
			text: '只会移除画布中的节点，不会删除仓库里的源文件、文件夹或画布。',
		});

		const actions = this.contentEl.createDiv({ cls: 'knowledge-map-globe-remove-dialog__actions' });
		const cancel = actions.createEl('button', { text: '取消', attr: { type: 'button' } });
		const confirm = actions.createEl('button', {
			cls: 'mod-warning',
			text: '移除',
			attr: { type: 'button' },
		});
		cancel.addEventListener('click', () => this.close());
		confirm.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});
		window.setTimeout(() => cancel.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
