import { App, Modal } from 'obsidian';
import { normalizeCustomNodeColor } from '../integrations/knowledge-canvas-model';

export class CustomNodeColorDialog extends Modal {
	private selectedColor: string;

	constructor(
		app: App,
		initialColor: string,
		private readonly onConfirm: (color: string) => void,
	) {
		super(app);
		this.selectedColor = normalizeCustomNodeColor(initialColor) ?? '#4b82b5';
	}

	onOpen(): void {
		this.modalEl.addClass('knowledge-map-color-dialog');
		this.titleEl.setText('自定义颜色');
		this.contentEl.createEl('p', {
			cls: 'knowledge-map-color-dialog__description',
			text: '点击色块打开色盘，也可以直接输入十六进制颜色。',
		});

		const picker = this.contentEl.createEl('input', {
			cls: 'knowledge-map-color-dialog__picker',
			attr: { type: 'color', 'aria-label': '打开颜色选择器' },
		});
		picker.value = this.selectedColor;

		const valueRow = this.contentEl.createDiv({ cls: 'knowledge-map-color-dialog__value-row' });
		const preview = valueRow.createSpan({ cls: 'knowledge-map-color-dialog__preview' });
		const valueInput = valueRow.createEl('input', {
			cls: 'knowledge-map-color-dialog__hex',
			attr: {
				type: 'text',
				maxlength: 7,
				spellcheck: 'false',
				'aria-label': '十六进制颜色',
			},
		});
		valueInput.value = this.selectedColor;
		const syncPreview = (): void => {
			preview.style.setProperty('--knowledge-map-dialog-color', this.selectedColor);
		};
		const syncFromPicker = (): void => {
			this.selectedColor = picker.value.toLowerCase();
			valueInput.value = this.selectedColor;
			syncPreview();
		};
		picker.addEventListener('input', syncFromPicker);
		picker.addEventListener('change', syncFromPicker);
		valueInput.addEventListener('input', () => {
			const color = normalizeCustomNodeColor(valueInput.value);
			valueInput.toggleClass('is-invalid', !color);
			if (!color) return;
			this.selectedColor = color;
			picker.value = color;
			syncPreview();
		});
		syncPreview();

		const actions = this.contentEl.createDiv({ cls: 'knowledge-map-color-dialog__actions' });
		const cancel = actions.createEl('button', { text: '取消' });
		cancel.addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { cls: 'mod-cta', text: '确认' });
		confirm.addEventListener('click', () => {
			const color = normalizeCustomNodeColor(valueInput.value);
			if (!color) {
				valueInput.addClass('is-invalid');
				valueInput.focus();
				return;
			}
			this.onConfirm(color);
			this.close();
		});
		valueInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') confirm.click();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
