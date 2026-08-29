import { describe, expect, it } from "vitest";
import {
  findDocumentFieldBlocks,
  parseDocumentFieldValues,
  updateDocumentFieldValue,
} from "../../src/features/document-metadata/fieldBlock";

describe("Knowledge Suite document field blocks", () => {
  it("does not treat ordinary Markdown as metadata", () => {
    const source = "# 标题\n\n正文 #标签\n";
    expect(findDocumentFieldBlocks(source)).toEqual([]);
  });

  it("inserts a new block after frontmatter without changing the body", () => {
    const source = "---\ntitle: 测试\n---\n\n# 标题\n正文\n";
    const result = updateDocumentFieldValue(source, "年份", 2025, ["年份"]);
    expect(result.createdBlock).toBe(true);
    expect(result.content).toBe(
      "---\ntitle: 测试\n---\n\n```knowledge-suite-fields\n年份: 2025\n```\n\n# 标题\n正文\n",
    );
    expect(result.content.endsWith("# 标题\n正文\n")).toBe(true);
  });

  it("updates only the managed block and preserves surrounding content", () => {
    const source = [
      "# 标题",
      "",
      "```knowledge-suite-fields",
      "年份: 2024",
      "标签:",
      "  - VLA",
      "```",
      "",
      "正文内容保持不变。",
      "",
    ].join("\n");
    const result = updateDocumentFieldValue(source, "年份", 2025, ["年份", "标签"]);
    expect(result.createdBlock).toBe(false);
    expect(result.content).toContain("年份: 2025");
    expect(result.content).toContain("标签:\n  - VLA");
    expect(result.content.endsWith("正文内容保持不变。\n")).toBe(true);
  });

  it("preserves CRLF line endings", () => {
    const source = "# 标题\r\n\r\n正文\r\n";
    const result = updateDocumentFieldValue(source, "status", "阅读中");
    expect(result.content).toContain("```knowledge-suite-fields\r\nstatus: 阅读中\r\n```");
    expect(result.content.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("parses scalar and list values", () => {
    expect(parseDocumentFieldValues("year: 2025\npublished: true\ntags:\n  - VLA\n  - 触觉\n")).toEqual({
      year: 2025,
      published: true,
      tags: ["VLA", "触觉"],
    });
  });

  it("rejects unsupported nested values", () => {
    expect(() => parseDocumentFieldValues("nested:\n  child: value\n")).toThrow("暂不支持");
  });

  it("refuses ambiguous documents with multiple managed blocks", () => {
    const source = "```knowledge-suite-fields\na: 1\n```\n\n```knowledge-suite-fields\nb: 2\n```\n";
    expect(() => updateDocumentFieldValue(source, "a", 2)).toThrow("多个");
  });
});
