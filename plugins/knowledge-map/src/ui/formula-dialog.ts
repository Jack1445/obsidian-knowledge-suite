import katex from 'katex';

interface FormulaSymbol {
	latex: string;
	display?: string;
	title?: string;
}

interface FormulaSymbolGroup {
	label?: string;
	symbols: FormulaSymbol[];
}

interface FormulaCategory {
	tab: string;
	groups: FormulaSymbolGroup[];
}

// Ported from Knowledge-main/src/features/notes/FormulaDialog.tsx. The editor
// and final canvas image share the same bundled KaTeX parser, so rendering does
// not depend on Excalidraw Extras or Obsidian's asynchronous MathJax lifecycle.
const FORMULA_CATEGORIES: FormulaCategory[] = [
	{
		tab: 'αβ',
		groups: [{
			symbols: [
				'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
				'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
				'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi',
				'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi',
				'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
			].map((name) => ({ latex: '\\' + name + ' ' })),
		}],
	},
	{
		tab: '×÷',
		groups: [
			{
				label: '二元运算符',
				symbols: [
					'pm', 'cap', 'diamond', 'oplus', 'mp', 'cup', 'triangle', 'ominus', 'times',
					'uplus', 'bigtriangledown', 'otimes', 'div', 'sqcap', 'triangleright', 'oslash',
					'cdot', 'sqcup', 'triangleleft', 'odot', 'star', 'ast', 'vee', 'amalg',
					'bigcirc', 'setminus', 'wedge', 'dagger', 'circ', 'bullet', 'wr', 'ddagger',
				].map((name) => ({ latex: '\\' + name + ' ' })),
			},
			{
				label: '大运算符',
				symbols: [
					'sum', 'prod', 'coprod', 'bigcup', 'bigcap', 'bigsqcup', 'bigvee', 'bigwedge',
					'biguplus', 'int', 'oint', 'bigodot', 'bigoplus', 'bigotimes',
				].map((name) => ({ latex: '\\' + name + ' ' })),
			},
		],
	},
	{
		tab: '≤≥',
		groups: [{
			symbols: [
				'leq', 'geq', 'equiv', 'models', 'prec', 'succ', 'sim', 'perp', 'preceq',
				'succeq', 'simeq', 'mid', 'll', 'gg', 'asymp', 'parallel', 'subset', 'supset',
				'approx', 'smile', 'sqsubseteq', 'sqsupseteq', 'cong', 'frown', 'sqsubset',
				'sqsupset', 'doteq', 'neq', 'in', 'ni', 'propto', 'notin', 'vdash', 'dashv',
				'bowtie', 'subseteq', 'supseteq',
			].map((name) => ({ latex: '\\' + name + ' ' })),
		}],
	},
	{
		tab: '𝑥ₐ',
		groups: [{
			symbols: [
				{ latex: 'x_{a}', title: '下标' },
				{ latex: 'x^{b}', title: '上标' },
				{ latex: 'x_{a}^{b}', title: '上下标' },
				{ latex: '\\bar{x}', title: '短横线' },
				{ latex: '\\overline{x}', title: '长横线' },
				{ latex: '\\frac{a}{b}', title: '分数' },
				{ latex: '\\sqrt{x}', title: '根号' },
				{ latex: '\\sqrt[n]{x}', title: 'n 次根' },
				{ latex: '\\bigcap_{a}^{b}', title: '大交' },
				{ latex: '\\bigcup_{a}^{b}', title: '大并' },
				{ latex: '\\prod_{a}^{b}', title: '连乘' },
				{ latex: '\\coprod_{a}^{b}', title: '余积' },
				{ latex: '\\left( x \\right)', title: '自适应圆括号' },
				{ latex: '\\left[ x \\right]', title: '自适应方括号' },
				{ latex: '\\left\\{ x \\right\\}', title: '自适应花括号' },
				{ latex: '\\left| x \\right|', title: '绝对值' },
				{ latex: '\\int_{a}^{b}', title: '定积分' },
				{ latex: '\\oint_{a}^{b}', title: '环积分' },
				{ latex: '\\sum_{a}^{b}{x}', title: '求和' },
				{ latex: '\\lim_{a \\to b} x', title: '极限' },
			],
		}],
	},
	{
		tab: '↑↓',
		groups: [{
			symbols: [
				'leftarrow', 'rightarrow', 'downarrow', 'uparrow', 'updownarrow', 'leftrightarrow',
				'Leftarrow', 'Rightarrow', 'Downarrow', 'Uparrow', 'Updownarrow', 'Leftrightarrow',
				'Longleftarrow', 'Longrightarrow', 'longleftrightarrow', 'longleftarrow',
				'longrightarrow', 'Longleftrightarrow', 'leftharpoonup', 'rightharpoonup',
				'leftharpoondown', 'rightharpoondown', 'mapsto', 'longmapsto', 'nwarrow',
				'nearrow', 'swarrow', 'searrow', 'hookleftarrow', 'hookrightarrow',
				'rightleftharpoons', 'leftrightharpoons',
			].map((name) => ({ latex: '\\' + name + ' ' })),
		}],
	},
];

function createMathMl(ownerDocument: Document, latex: string, displayMode: boolean): MathMLElement | null {
	const markup = katex.renderToString(latex, {
		displayMode,
		output: 'mathml',
		strict: 'ignore',
		throwOnError: false,
	});
	const Parser = ownerDocument.defaultView?.DOMParser ?? DOMParser;
	const parsed = new Parser().parseFromString(markup, 'text/html');
	const math = parsed.querySelector('math');
	return math ? ownerDocument.importNode(math, true) : null;
}

export interface RenderedLatexSvg {
	dataURL: string;
	width: number;
	height: number;
}

export async function renderLatexToSvg(
	latex: string,
	ownerDocument: Document = document,
): Promise<RenderedLatexSvg | null> {
	const math = createMathMl(ownerDocument, latex, true);
	if (!math) return null;
	math.setAttribute('display', 'block');
	math.setAttribute('class', [math.getAttribute('class'), 'knowledge-map-formula-export-math']
		.filter(Boolean).join(' '));

	const measurement = ownerDocument.body.createDiv({ cls: 'knowledge-map-formula-measurement' });
	measurement.appendChild(math);
	const bounds = math.getBoundingClientRect();
	const width = Math.ceil(Math.max(48, bounds.width + 24));
	const height = Math.ceil(Math.max(56, bounds.height + 20));
	measurement.remove();

	const serializer = new XMLSerializer();
	const mathXml = serializer.serializeToString(math);
	const xml = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		'<style>.knowledge-map-formula-export-math{font-family:"Cambria Math","STIX Two Math",serif;font-size:28px;color:#2f2b27}</style>',
		`<foreignObject x="0" y="0" width="${width}" height="${height}">`,
		`<div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;width:${width}px;height:${height}px;align-items:center;justify-content:center;overflow:visible">`,
		mathXml,
		'</div></foreignObject></svg>',
	].join('');
	const bytes = new TextEncoder().encode(xml);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return {
		dataURL: 'data:image/svg+xml;base64,' + btoa(binary),
		width,
		height,
	};
}

export async function renderLatexToSvgDataUrl(
	latex: string,
	ownerDocument: Document = document,
): Promise<string | null> {
	return (await renderLatexToSvg(latex, ownerDocument))?.dataURL ?? null;
}

export interface FormulaDialogOptions {
	document: Document;
	initialLatex: string;
	anchor: { left: number; bottom: number };
	onConfirm: (latex: string) => void | Promise<void>;
	onCancel?: () => void;
}

export class KnowledgeFormulaDialog {
	private overlay: HTMLElement | null = null;
	private panel: HTMLElement | null = null;
	private textarea: HTMLTextAreaElement | null = null;
	private highlight: HTMLElement | null = null;
	private preview: HTMLElement | null = null;
	private symbolPanel: HTMLElement | null = null;
	private activeCategory: number | null = null;
	private closed = false;

	constructor(private readonly options: FormulaDialogOptions) {}

	open(): void {
		const { document } = this.options;
		this.overlay = document.body.createDiv({ cls: 'knowledge-map-formula-overlay' });
		this.panel = document.body.createDiv({ cls: 'knowledge-map-formula-dialog' });
		this.panel.setAttribute('role', 'dialog');
		this.panel.setAttribute('aria-label', '公式编辑器');
		this.positionPanel();

		const tabs = this.panel.createDiv({ cls: 'knowledge-map-formula-tabs' });
		FORMULA_CATEGORIES.forEach((category, index) => {
			const button = tabs.createEl('button', { text: category.tab });
			button.type = 'button';
			button.addEventListener('pointerdown', (event) => event.preventDefault());
			button.addEventListener('click', () => this.toggleCategory(index, button));
		});
		const help = tabs.createEl('a', { text: '? 语法', cls: 'knowledge-map-formula-help' });
		help.href = 'https://katex.org/docs/supported.html';
		help.target = '_blank';
		help.rel = 'noopener noreferrer';

		const editor = this.panel.createDiv({ cls: 'knowledge-map-formula-editor' });
		this.highlight = editor.createEl('pre', { cls: 'knowledge-map-formula-highlight' });
		this.highlight.setAttribute('aria-hidden', 'true');
		this.textarea = editor.createEl('textarea', { cls: 'knowledge-map-formula-input' });
		this.textarea.rows = 3;
		this.textarea.spellcheck = false;
		this.textarea.autofocus = true;
		this.textarea.placeholder = '输入 LaTeX，例如 a + b\\sigma、\\frac{a}{b}、\\sum_{i=1}^{n}';
		this.textarea.value = this.options.initialLatex;

		this.preview = this.panel.createDiv({ cls: 'knowledge-map-formula-preview' });
		const footer = this.panel.createDiv({ cls: 'knowledge-map-formula-footer' });
		footer.createSpan({ text: 'Ctrl/⌘ + Enter', cls: 'knowledge-map-formula-hint' });
		const cancel = footer.createEl('button', { text: '取消', cls: 'knowledge-map-formula-cancel' });
		cancel.type = 'button';
		const confirm = footer.createEl('button', { text: '确定', cls: 'knowledge-map-formula-confirm' });
		confirm.type = 'button';

		this.overlay.addEventListener('pointerdown', () => void this.confirm());
		this.panel.addEventListener('pointerdown', (event) => event.stopPropagation());
		cancel.addEventListener('click', () => this.cancel());
		confirm.addEventListener('click', () => void this.confirm());
		this.textarea.addEventListener('input', () => this.update());
		this.textarea.addEventListener('scroll', () => this.syncScroll());
		this.textarea.addEventListener('keydown', (event) => this.onKeyDown(event));

		this.update();
		const view = document.defaultView ?? window;
		const focusInput = (): void => {
			if (this.closed || !this.textarea) return;
			this.textarea.focus({ preventScroll: true });
			const end = this.textarea.value.length;
			this.textarea.setSelectionRange(end, end);
			this.update();
			this.syncScroll();
		};
		view.requestAnimationFrame(focusInput);
		view.setTimeout(focusInput, 80);
	}

	private positionPanel(): void {
		if (!this.panel) return;
		const view = this.options.document.defaultView ?? window;
		const width = Math.min(520, view.innerWidth - 24);
		let left = this.options.anchor.left;
		left = Math.max(12, Math.min(left, view.innerWidth - width - 12));
		let top = this.options.anchor.bottom + 8;
		if (top + 360 > view.innerHeight - 12) top = Math.max(12, this.options.anchor.bottom - 390);
		Object.assign(this.panel.style, { left: left + 'px', top: top + 'px', width: width + 'px' });
	}

	private toggleCategory(index: number, button: HTMLButtonElement): void {
		if (this.activeCategory === index) {
			this.closeSymbolPanel();
			return;
		}
		this.closeSymbolPanel();
		this.activeCategory = index;
		button.addClass('is-active');
		const category = FORMULA_CATEGORIES[index];
		if (!category || !this.panel) return;
		this.symbolPanel = this.panel.createDiv({ cls: 'knowledge-map-formula-symbol-panel' });
		for (const group of category.groups) {
			const groupEl = this.symbolPanel.createDiv({ cls: 'knowledge-map-formula-symbol-group' });
			if (group.label) groupEl.createDiv({ text: group.label, cls: 'knowledge-map-formula-symbol-label' });
			const grid = groupEl.createDiv({ cls: 'knowledge-map-formula-symbol-grid' });
			for (const symbol of group.symbols) {
				const symbolButton = grid.createEl('button', { cls: 'knowledge-map-formula-symbol' });
				symbolButton.type = 'button';
				symbolButton.title = symbol.title ?? symbol.latex.trim();
				this.renderFormula(symbolButton, symbol.display ?? symbol.latex.trim());
				symbolButton.addEventListener('pointerdown', (event) => event.preventDefault());
				symbolButton.addEventListener('click', () => this.insert(symbol));
			}
		}
		this.positionPanel();
	}

	private closeSymbolPanel(): void {
		this.symbolPanel?.remove();
		this.symbolPanel = null;
		this.activeCategory = null;
		this.panel?.querySelectorAll('.knowledge-map-formula-tabs button.is-active')
			.forEach((element) => element.removeClass('is-active'));
	}

	private insert(symbol: FormulaSymbol): void {
		const input = this.textarea;
		if (!input) return;
		const start = input.selectionStart;
		const end = input.selectionEnd;
		input.value = input.value.slice(0, start) + symbol.latex + input.value.slice(end);
		let caret = start + symbol.latex.length;
		const braceIndex = symbol.latex.indexOf('{}');
		if (braceIndex >= 0) caret = start + braceIndex + 1;
		this.closeSymbolPanel();
		this.update();
		input.focus();
		input.setSelectionRange(caret, caret);
	}

	private update(): void {
		const latex = this.textarea?.value ?? '';
		this.renderHighlight(latex);
		if (!this.preview) return;
		this.preview.empty();
		if (!latex.trim()) {
			this.preview.createSpan({ text: '公式预览', cls: 'knowledge-map-formula-preview-placeholder' });
			return;
		}
		this.renderFormula(this.preview, latex, true);
	}

	private renderHighlight(source: string): void {
		if (!this.highlight) return;
		this.highlight.empty();
		const regex = /\\[a-zA-Z]+|[{}^_]/g;
		let offset = 0;
		for (const match of source.matchAll(regex)) {
			const index = match.index ?? 0;
			this.highlight.appendText(source.slice(offset, index));
			this.highlight.createSpan({ text: match[0], cls: 'knowledge-map-formula-command' });
			offset = index + match[0].length;
		}
		this.highlight.appendText(source.slice(offset) + '\n');
	}

	private renderFormula(container: HTMLElement, latex: string, display = false): void {
		try {
			const math = createMathMl(container.ownerDocument, latex, display);
			if (!math) throw new Error('KaTeX did not produce MathML.');
			container.appendChild(math);
		} catch {
			container.createSpan({ text: latex, cls: 'knowledge-map-formula-render-error' });
		}
	}

	private syncScroll(): void {
		if (!this.textarea || !this.highlight) return;
		this.highlight.scrollTop = this.textarea.scrollTop;
		this.highlight.scrollLeft = this.textarea.scrollLeft;
	}

	private onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			this.cancel();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			void this.confirm();
		}
	}

	private async confirm(): Promise<void> {
		if (this.closed) return;
		const latex = this.textarea?.value ?? '';
		this.close();
		await this.options.onConfirm(latex);
	}

	private cancel(): void {
		if (this.closed) return;
		this.close();
		this.options.onCancel?.();
	}

	private close(): void {
		this.closed = true;
		this.overlay?.remove();
		this.panel?.remove();
		this.overlay = null;
		this.panel = null;
	}
}
