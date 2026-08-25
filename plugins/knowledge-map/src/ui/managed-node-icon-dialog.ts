import { App, getIconIds, Modal, setIcon } from 'obsidian';
import type { KnowledgeCanvasNodeIcon } from '../integrations/knowledge-canvas-model';

interface IconOption {
	icon: KnowledgeCanvasNodeIcon;
	label: string;
	preview?: string;
}

const EMOJI_OPTIONS: readonly IconOption[] = ([
	['🌐', '地球'], ['🌍', '世界'], ['🧠', '大脑'], ['📚', '书籍'], ['📖', '阅读'],
	['🗂️', '分类'], ['📁', '文件夹'], ['🧭', '指南针'], ['🗺️', '地图'], ['🏠', '主页'],
	['⭐', '星星'], ['✨', '闪光'], ['💡', '灵感'], ['🚀', '火箭'], ['🎯', '目标'],
	['🔬', '研究'], ['🧩', '拼图'], ['🔗', '链接'], ['🔖', '书签'], ['🏷️', '标签'],
	['📌', '图钉'], ['📍', '位置'], ['🔑', '钥匙'], ['🛡️', '盾牌'], ['⚙️', '设置'],
	['🛠️', '工具'], ['🔍', '搜索'], ['📊', '图表'], ['📈', '增长'], ['🗃️', '资料库'],
	['💾', '保存'], ['☁️', '云端'], ['💻', '电脑'], ['📱', '手机'], ['⌨️', '键盘'],
	['🎨', '艺术'], ['✏️', '书写'], ['🖋️', '钢笔'], ['📷', '相机'], ['🎵', '音乐'],
	['🎬', '影像'], ['🧪', '实验'], ['🧬', '基因'], ['⚛️', '原子'], ['🔭', '天文'],
	['🌱', '成长'], ['🌿', '植物'], ['🌳', '树木'], ['🍀', '幸运'], ['🌸', '花朵'],
	['☀️', '太阳'], ['🌙', '月亮'], ['⚡', '能量'], ['🔥', '火焰'], ['💧', '水滴'],
	['🏔️', '山峰'], ['🌊', '海洋'], ['❤️', '喜欢'], ['💎', '宝石'], ['👑', '皇冠'],
	['🏆', '奖杯'], ['🥇', '第一'], ['✅', '完成'], ['❗', '重要'], ['❓', '问题'],
	['💬', '交流'], ['👥', '团队'], ['🤝', '合作'], ['🙋', '人物'], ['🧑‍💻', '开发'],
	['📅', '日历'], ['⏰', '时间'], ['🚩', '旗帜'], ['🛤️', '路径'], ['🧱', '模块'],
	['📦', '包裹'], ['🔮', '水晶球'], ['🌀', '旋涡'], ['♾️', '无限'], ['🎓', '学习'],
] as const).map(([preview, label]) => ({ icon: { kind: 'emoji', value: preview }, label, preview }));

const FEATURED_LUCIDE_IDS = [
	'network', 'globe-2', 'folder-tree', 'brain', 'book-open', 'map', 'compass', 'star',
	'lightbulb', 'rocket', 'target', 'microscope', 'puzzle', 'database', 'layers', 'workflow',
	'atom', 'orbit', 'sparkles', 'house', 'heart', 'flag', 'calendar', 'clock', 'code-2',
	'terminal', 'chart-no-axes-combined', 'music', 'image', 'palette', 'camera', 'pen-tool',
	'search', 'link', 'tag', 'bookmark', 'shield', 'key-round', 'box', 'package', 'cloud',
	'leaf', 'mountain', 'sun', 'moon', 'zap', 'flame', 'crown', 'gem', 'circle-dot',
	'triangle', 'diamond', 'message-circle', 'users', 'graduation-cap', 'telescope', 'dna',
] as const;

function iconKey(icon: KnowledgeCanvasNodeIcon): string {
	return `${icon.kind}:${icon.value ?? ''}`;
}

export class ManagedNodeIconDialog extends Modal {
	private selectedIcon: KnowledgeCanvasNodeIcon;
	private readonly optionButtons: HTMLButtonElement[] = [];
	private readonly lucideIds = getIconIds().map(String).sort((left, right) => left.localeCompare(right));

	constructor(
		app: App,
		initialIcon: KnowledgeCanvasNodeIcon,
		private readonly onConfirm: (icon: KnowledgeCanvasNodeIcon) => void,
	) {
		super(app);
		this.selectedIcon = { ...initialIcon };
	}

	onOpen(): void {
		this.modalEl.addClass('knowledge-map-design-dialog', 'knowledge-map-icon-dialog');
		this.titleEl.setText('选择节点图标');

		this.addSection('显示方式', [
			{ icon: { kind: 'auto' }, label: '自动匹配画布类型', preview: '自动' },
			{ icon: { kind: 'none' }, label: '不显示图标', preview: '无' },
		], 'is-mode');

		const searchShell = this.contentEl.createDiv({ cls: 'knowledge-map-icon-dialog__search' });
		const searchIcon = searchShell.createSpan();
		setIcon(searchIcon, 'search');
		const searchInput = searchShell.createEl('input', {
			attr: {
				type: 'search',
				placeholder: `搜索 ${this.lucideIds.length} 个 Obsidian 图标或 Emoji`,
				'aria-label': '搜索图标',
			},
		});

		const librarySection = this.createSection('Obsidian 图标库', '基于 Lucide，支持当前 Obsidian 已安装的全部图标');
		const libraryGrid = librarySection.createDiv({ cls: 'knowledge-map-icon-dialog__grid is-library' });
		const emojiSection = this.createSection('Emoji', '常用分类，可输入中文名称搜索');
		const emojiGrid = emojiSection.createDiv({ cls: 'knowledge-map-icon-dialog__grid is-emoji' });
		const emptyState = this.contentEl.createDiv({
			cls: 'knowledge-map-icon-dialog__empty',
			text: '没有找到匹配的图标',
		});
		let libraryExpanded = false;
		let emojiExpanded = false;

		const renderSearchResults = (): void => {
			const query = searchInput.value.trim().toLocaleLowerCase();
			libraryGrid.empty();
			emojiGrid.empty();
			const available = new Map(this.lucideIds.map((id) => [id.replace(/^lucide-/, ''), id]));
			const allLucideMatches = query
				? this.lucideIds.filter((id) => id.toLocaleLowerCase().includes(query)).slice(0, 140)
				: FEATURED_LUCIDE_IDS.flatMap((id) => available.get(id) ?? []).slice(0, 60);
			if (!query && allLucideMatches.length === 0) allLucideMatches.push(...this.lucideIds.slice(0, 60));
			const lucideMatches = query || libraryExpanded ? allLucideMatches : allLucideMatches.slice(0, 20);
			const allEmojiMatches = query
				? EMOJI_OPTIONS.filter((option) => `${option.label}${option.preview ?? ''}`.toLocaleLowerCase().includes(query))
				: EMOJI_OPTIONS;
			const emojiMatches = query || emojiExpanded ? allEmojiMatches : allEmojiMatches.slice(0, 20);
			for (const id of lucideMatches) {
				this.addOptionButton(libraryGrid, { icon: { kind: 'lucide', value: id }, label: id });
			}
			if (!query && allLucideMatches.length > 20) {
				this.addMoreButton(libraryGrid, libraryExpanded, () => {
					libraryExpanded = !libraryExpanded;
					renderSearchResults();
				}, '更多图标');
			}
			for (const option of emojiMatches) this.addOptionButton(emojiGrid, option);
			if (!query && allEmojiMatches.length > 20) {
				this.addMoreButton(emojiGrid, emojiExpanded, () => {
					emojiExpanded = !emojiExpanded;
					renderSearchResults();
				}, '更多表情');
			}
			librarySection.toggle(lucideMatches.length > 0);
			emojiSection.toggle(emojiMatches.length > 0);
			emptyState.toggle(lucideMatches.length === 0 && emojiMatches.length === 0);
			this.refreshSelection();
		};
		searchInput.addEventListener('input', renderSearchResults);
		renderSearchResults();

		const customSection = this.createSection('自定义字符', '可输入单个 Emoji、汉字或简短符号');
		const customRow = customSection.createDiv({ cls: 'knowledge-map-icon-dialog__custom' });
		const customInput = customRow.createEl('input', {
			attr: {
				type: 'text',
				maxlength: 8,
				placeholder: '例如：知、AI、✺',
				'aria-label': '自定义图标字符',
			},
		});
		if (this.selectedIcon.kind === 'text') customInput.value = this.selectedIcon.value ?? '';
		customInput.addEventListener('input', () => {
			const value = customInput.value.trim();
			if (!value) return;
			this.selectedIcon = { kind: 'text', value };
			this.refreshSelection();
		});

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
			if (this.selectedIcon.kind === 'text' && !this.selectedIcon.value?.trim()) {
				customInput.focus();
				return;
			}
			this.onConfirm({ ...this.selectedIcon });
			this.close();
		});
		this.refreshSelection();
	}

	onClose(): void {
		this.optionButtons.length = 0;
		this.contentEl.empty();
	}

	private createSection(title: string, description?: string): HTMLElement {
		const section = this.contentEl.createDiv({ cls: 'knowledge-map-icon-dialog__section' });
		const heading = section.createDiv({ cls: 'knowledge-map-icon-dialog__section-heading' });
		heading.createEl('h3', { text: title });
		if (description) heading.createSpan({ text: description });
		return section;
	}

	private addSection(title: string, options: readonly IconOption[], modifier = ''): void {
		const section = this.createSection(title);
		const grid = section.createDiv({ cls: `knowledge-map-icon-dialog__grid ${modifier}`.trim() });
		for (const option of options) this.addOptionButton(grid, option);
	}

	private addOptionButton(grid: HTMLElement, option: IconOption): void {
		const button = grid.createEl('button', {
			cls: 'knowledge-map-icon-dialog__option',
			attr: {
				type: 'button',
				title: option.label,
				'aria-label': option.label,
			},
		});
		button.dataset.iconKey = iconKey(option.icon);
		const preview = button.createSpan({ cls: 'knowledge-map-icon-dialog__option-preview' });
		if (option.icon.kind === 'lucide' && option.icon.value) setIcon(preview, option.icon.value);
		else preview.setText(option.preview ?? option.label);
		button.addEventListener('click', () => {
			this.selectedIcon = { ...option.icon };
			this.refreshSelection();
		});
		this.optionButtons.push(button);
	}

	private addMoreButton(
		grid: HTMLElement,
		expanded: boolean,
		onClick: () => void,
		expandTitle: string,
	): void {
		const more = grid.createEl('button', {
			cls: 'knowledge-map-icon-dialog__option is-more',
			attr: { type: 'button', title: expanded ? '收起' : expandTitle },
		});
		const moreIcon = more.createSpan({ cls: 'knowledge-map-icon-dialog__option-preview' });
		setIcon(moreIcon, expanded ? 'chevrons-up' : 'ellipsis');
		more.createSpan({ text: expanded ? '收起' : '更多' });
		more.addEventListener('click', onClick);
	}

	private refreshSelection(): void {
		const selectedKey = iconKey(this.selectedIcon);
		for (let index = this.optionButtons.length - 1; index >= 0; index -= 1) {
			const button = this.optionButtons[index];
			if (!button?.isConnected) {
				this.optionButtons.splice(index, 1);
				continue;
			}
			button.toggleClass('is-active', button.dataset.iconKey === selectedKey);
		}
	}
}
