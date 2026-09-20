import { readFileSync } from "node:fs";
import ts from "typescript";
import { getInlineBoldRanges, getInlineTextRuns, shouldRenderInlineTextEditorTextRun } from "../src/inlineTextStyle";

// Exercise the production DOM painter without booting Obsidian's App class.
// Font metrics are deterministic here; native Electron layout needs user QA.
const source = ts.createSourceFile("editor.tsx", readFileSync("packages/excalidraw/wysiwyg/textWysiwyg.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let painter = "";
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "updateInlineTextOverlay") painter = node.initializer!.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
const js = ts.transpileModule(`const update = ${painter};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(value: string, bold = true, rtl = false, bound = false) {
  const editable = document.createElement("textarea");
  editable.value = value;
  editable.setSelectionRange(0, 3);
  const formulaLayer = document.createElement("div");
  const element = {
    strokeColor: "#111111", opacity: 100, fontSize: 20, fontFamily: 1,
    lineHeight: 1.25, textAlign: "left", width: 400, autoResize: true,
    containerId: bound ? "container" : null,
    customData: { obsidianInlineTextStyles: { version: 1, bold: bold ? [{ start: 0, end: 4 }] : [] } },
  };
  const dependencies = {
    editable, formulaLayer, getInlineBoldRanges, getInlineTextRuns,
    shouldRenderInlineTextEditorTextRun,
    app: { state: { theme: "light", viewBackgroundColor: "#fff" } },
    THEME: { DARK: "dark" }, applyDarkModeFilter: (c: string) => c,
    isRTL: () => rtl, getFontString: () => "20px sans-serif",
    getInlineBoldFontString: () => "700 20px sans-serif",
    getLineHeightInPx: () => 25, getVerticalOffset: () => 0,
    getWrappedTextLines: (text: string) => {
      let start = 0;
      return text.split("\n").map((line) => {
        const result = { text: line, start }; start += line.length + 1; return result;
      });
    },
    getInlineTextLineWidth: () => 100,
    getLineWidth: (text: string) => text.length * 10,
    getInlineTextRunCaretOffset: () => 0,
    getInlineFormulaRenderSize: () => ({ width: 20, height: 20 }),
    beginInlineSelectionDrag: () => undefined,
  };
  const run = new Function(...Object.keys(dependencies), `let inlineTextHitTargets = []; let inlineBoldRanges = []; ${js} return update;`)(...Object.values(dependencies));
  return { editable, formulaLayer, element, run };
}

describe("inline editor overlay avoids double painting", () => {
  it("keeps the caret visible on a trailing empty line", () => {
    const f = fixture("Bold\n"); f.editable.setSelectionRange(5, 5); f.run(f.element);
    expect(Array.from(f.formulaLayer.querySelectorAll("span")).some((s) => s.style.width === "1px" && s.style.top === "25px" && s.style.background !== "transparent")).toBe(true);
  });
  it("preserves formula previews and their plain suffix", () => {
    const f = fixture("Bold \\(x\\) suffix");
    f.run({ ...f.element, customData: { ...f.element.customData,
      obsidianInlineFormulas: { version: 1, items: [{ latex: "x", dataURL: "data:image/svg+xml,test", width: 20, height: 20 }] },
    } });
    expect(f.formulaLayer.querySelector("img")?.alt).toBe("x");
    expect(f.formulaLayer.querySelector("img")?.style.height).toBe("20px");
    expect(f.formulaLayer.textContent).toContain(" suffix");
    expect(f.editable.style.color).toBe("transparent");
  });
  it("renders bold, its plain suffix and plain-only lines, with visual selection", () => {
    const f = fixture("Bold suffix\n普通文字"); f.run(f.element);
    expect(f.editable.style.color).toBe("transparent");
    expect(f.editable.style.caretColor).toBe("transparent");
    expect(f.formulaLayer.textContent).toBe("Bold suffix普通文字");
    const spans = Array.from(f.formulaLayer.querySelectorAll("span"));
    expect(spans.find((span) => span.textContent === "Bold")?.style.fontWeight).toBe("700");
    expect(spans.find((span) => span.textContent === " suffix")?.style.fontWeight).toBe("400");
    expect(spans.some((span) => span.style.background.toLowerCase() === "highlight")).toBe(true);
    expect(f.editable.value).toBe("Bold suffix\n普通文字");
  });
  it("draws a visual caret and restores native editing after bold is removed", () => {
    const f = fixture("Bold suffix"); f.editable.setSelectionRange(5, 5); f.run(f.element);
    expect(Array.from(f.formulaLayer.querySelectorAll("span")).some((s) => s.style.width === "1px")).toBe(true);
    f.element.customData.obsidianInlineTextStyles.bold = []; f.run(f.element);
    expect(f.formulaLayer.hidden).toBe(true);
    expect(f.editable.style.color).not.toBe("transparent");
    expect(f.editable.style.caretColor).not.toBe("transparent");
  });
  it.each([[false, false, false], [true, true, false], [true, false, true]])("keeps native fallback visible (%s,%s,%s)", (bold, rtl, bound) => {
    const f = fixture("text", bold, rtl, bound); f.run(f.element);
    expect(f.formulaLayer.hidden).toBe(true);
    expect(f.editable.style.color).not.toBe("transparent");
  });
});
