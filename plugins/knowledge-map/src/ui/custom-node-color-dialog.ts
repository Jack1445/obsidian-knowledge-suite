import { App, Modal, setIcon } from 'obsidian';
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
		this.modalEl.addClass('knowledge-map-design-dialog', 'knowledge-map-color-dialog');
		this.titleEl.setText('创建自定义颜色');
		this.contentEl.createEl('p', {
			cls: 'knowledge-map-design-dialog__description',
			text: '从色盘中挑选颜色，保存后会加入“我的颜色”，可在其他节点上重复使用。',
		});

		const colorCard = this.contentEl.createDiv({ cls: 'knowledge-map-color-dialog__card' });
		const preview = colorCard.createSpan({ cls: 'knowledge-map-color-dialog__preview' });
		const colorCardCopy = colorCard.createDiv({ cls: 'knowledge-map-color-dialog__card-copy' });
		colorCardCopy.createEl('strong', { text: '当前颜色' });
		const colorValue = colorCardCopy.createSpan();
		const pickerButton = colorCard.createEl('label', {
			cls: 'knowledge-map-color-dialog__picker-button',
			attr: { title: '打开色盘' },
		});
		const pickerButtonIcon = pickerButton.createSpan();
		setIcon(pickerButtonIcon, 'pipette');
		pickerButton.createSpan({ text: '打开色盘' });
		const picker = pickerButton.createEl('input', {
			cls: 'knowledge-map-color-dialog__picker',
			attr: { type: 'color', 'aria-label': '打开颜色选择器' },
		});
		picker.value = this.selectedColor;

		const valueRow = this.contentEl.createDiv({ cls: 'knowledge-map-color-dialog__value-row' });
		const valueLabel = valueRow.createEl('label');
		valueLabel.createSpan({ text: '十六进制色值' });
		const valueInput = valueRow.createEl('input', {
			cls: 'knowledge-map-color-dialog__hex',
			attr: {
				type: 'text',
				maxlength: 7,
				spellcheck: 'false',
				'aria-label': '十六进制颜色',
			},
		});
		valueLabel.appendChild(valueInput);
		valueInput.value = this.selectedColor;
		const syncPreview = (): void => {
			preview.style.setProperty('--knowledge-map-dialog-color', this.selectedColor);
			colorValue.setText(this.selectedColor.toUpperCase());
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

		const actions = this.contentEl.createDiv({ cls: 'knowledge-map-design-dialog__actions' });
		const cancel = actions.createEl('button', {
			cls: 'knowledge-map-design-dialog__button is-secondary',
			text: '取消',
		});
		cancel.addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', {
			cls: 'knowledge-map-design-dialog__button is-primary',
			text: '确定',
		});
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
