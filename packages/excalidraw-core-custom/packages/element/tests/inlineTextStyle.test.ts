import { getFontString } from "@excalidraw/common";

import { getInlineFormulaEditableText } from "../src/inlineFormula";
import {
  getInlineTextLineWidth,
  getInlineTextRunCaretOffset,
  getInlineTextRuns,
  rebaseInlineBoldRanges,
  shouldRenderInlineTextEditorTextRun,
  toggleInlineBoldRange,
} from "../src/inlineTextStyle";
import { getLineWidth } from "../src/textMeasurements";

describe("inline text bold ranges", () => {
  it("toggles only the selected characters", () => {
    expect(toggleInlineBoldRange([], 2, 5, 8)).toEqual([
      { start: 2, end: 5 },
    ]);
    expect(
      toggleInlineBoldRange([{ start: 2, end: 5 }], 3, 4, 8),
    ).toEqual([
      { start: 2, end: 3 },
      { start: 4, end: 5 },
    ]);
  });

  it("moves ranges when text is inserted before them", () => {
    expect(
      rebaseInlineBoldRanges(
        "hello world",
        "hello new world",
        [{ start: 6, end: 11 }],
      ),
    ).toEqual([{ start: 10, end: 15 }]);
  });

  it("keeps inserted text bold while typing inside a bold range", () => {
    expect(
      rebaseInlineBoldRanges(
        "hello",
        "helXlo",
        [{ start: 1, end: 4 }],
      ),
    ).toEqual([{ start: 1, end: 5 }]);
  });

  it("preserves the remaining bold text after deletion", () => {
    expect(
      rebaseInlineBoldRanges(
        "hello world",
        "hello orld",
        [{ start: 6, end: 11 }],
      ),
    ).toEqual([{ start: 6, end: 10 }]);
  });
});

describe("inline formula editor layout", () => {
  it("keeps suffix text adjacent to the rendered formula width", () => {
    const text = "before \\(formula-with-a-very-long-source\\) after";
    const element = {
      fontFamily: 1,
      fontSize: 20,
      customData: {
        obsidianInlineFormulas: {
          version: 1,
          items: [
            {
              latex: "formula-with-a-very-long-source",
              dataURL: "data:image/svg+xml,test",
              width: 10,
              height: 10,
            },
          ],
        },
      },
    } as const;
    const runs = getInlineTextRuns(text, 0, element);
    const font = getFontString(element);
    const nativeSourceWidth =
      getLineWidth("before ", font) +
      getLineWidth("\\(formula-with-a-very-long-source\\)", font) +
      getLineWidth(" after", font);
    const renderedWidth =
      getLineWidth("before ", font) +
      20 +
      getLineWidth(" after", font);

    expect(getInlineTextLineWidth(runs, element)).toBeCloseTo(renderedWidth);
    expect(getInlineTextLineWidth(runs, element)).toBeLessThan(
      nativeSourceWidth,
    );
  });

  it("renders a regular suffix in the overflow-visible formula editor layer", () => {
    const text = "before \\(wide\\) visible suffix";
    const element = {
      fontFamily: 1,
      fontSize: 20,
      customData: {
        obsidianInlineFormulas: {
          version: 1,
          items: [
            {
              latex: "wide",
              dataURL: "data:image/svg+xml,test",
              width: 10,
              height: 10,
            },
          ],
        },
      },
    } as const;
    const runs = getInlineTextRuns(text, 0, element);
    const suffix = runs.find(
      (run) => run.type === "text" && run.text === " visible suffix",
    );

    expect(suffix?.type).toBe("text");
    expect(
      suffix?.type === "text" &&
        shouldRenderInlineTextEditorTextRun(suffix, true),
    ).toBe(true);
  });

  it("maps a click on the compact suffix to the suffix source offset", () => {
    const element = { fontFamily: 1, fontSize: 20 } as const;
    const formulaSourceEnd = "before \\(very-long-formula-source\\)".length;

    expect(
      formulaSourceEnd +
        getInlineTextRunCaretOffset("suffix", 16, element),
    ).toBe(formulaSourceEnd + 2);
  });

  it("maps both endpoints of a compact suffix drag selection", () => {
    const element = { fontFamily: 1, fontSize: 20 } as const;
    const formulaSourceEnd = "before \\(very-long-formula-source\\)".length;
    const anchor =
      formulaSourceEnd +
      getInlineTextRunCaretOffset("suffix", 4, element);
    const focus =
      formulaSourceEnd +
      getInlineTextRunCaretOffset("suffix", 36, element);

    expect([anchor, focus]).toEqual([
      formulaSourceEnd,
      formulaSourceEnd + 4,
    ]);
  });

  it("restores suffix text when the host cache and rawText are truncated", () => {
    const truncated = "怎么说完全大量低 \\(a+b\\)";
    const complete = `${truncated} 价瓦利姐妹俩`;
    const element = {
      rawText: truncated,
      originalText: complete,
      customData: {
        obsidianInlineFormulas: {
          version: 1,
          items: [
            {
              latex: "a+b",
              dataURL: "data:image/svg+xml,test",
              width: 20,
              height: 10,
            },
          ],
        },
      },
    } as const;

    expect(getInlineFormulaEditableText(element, truncated)).toBe(complete);
  });

  it("keeps the host source for text without a persisted formula", () => {
    expect(
      getInlineFormulaEditableText(
        {
          rawText: "scene text",
          originalText: "scene text",
          customData: undefined,
        },
        "host text",
      ),
    ).toBe("host text");
  });
});
