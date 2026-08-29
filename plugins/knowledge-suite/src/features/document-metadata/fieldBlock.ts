import { parse, stringify } from "yaml";
import type { DocumentFieldValue, DocumentFieldValues } from "./types";

export const DOCUMENT_FIELDS_BLOCK_LANGUAGE = "knowledge-suite-fields";

export type DocumentFieldBlock = {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  source: string;
};

export type DocumentFieldBlockUpdate = {
  content: string;
  createdBlock: boolean;
  values: DocumentFieldValues;
};

type SourceLine = {
  start: number;
  end: number;
  text: string;
};

const sourceLines = (content: string): SourceLine[] => {
  const lines: SourceLine[] = [];
  let offset = 0;
  while (offset < content.length) {
    const newlineIndex = content.indexOf("\n", offset);
    const end = newlineIndex === -1 ? content.length : newlineIndex + 1;
    const raw = content.slice(offset, newlineIndex === -1 ? end : newlineIndex);
    lines.push({
      start: offset,
      end,
      text: raw.endsWith("\r") ? raw.slice(0, -1) : raw,
    });
    offset = end;
  }
  return lines;
};

/** Locates fenced Knowledge Suite field blocks without interpreting other Markdown. */
export const findDocumentFieldBlocks = (content: string): DocumentFieldBlock[] => {
  const lines = sourceLines(content);
  const blocks: DocumentFieldBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].text.match(
      /^([ \t]*)(`{3,}|~{3,})knowledge-suite-fields(?:[ \t]+.*)?[ \t]*$/,
    );
    if (!opening) continue;
    const marker = opening[2][0];
    const minimumLength = opening[2].length;
    for (let closingIndex = index + 1; closingIndex < lines.length; closingIndex += 1) {
      const closing = lines[closingIndex].text.match(/^([ \t]*)(`{3,}|~{3,})[ \t]*$/);
      if (
        !closing ||
        closing[2][0] !== marker ||
        closing[2].length < minimumLength
      ) {
        continue;
      }
      const contentStart = lines[index].end;
      const contentEnd = lines[closingIndex].start;
      blocks.push({
        start: lines[index].start,
        end: lines[closingIndex].end,
        contentStart,
        contentEnd,
        source: content.slice(contentStart, contentEnd),
      });
      index = closingIndex;
      break;
    }
  }
  return blocks;
};

const normalizeValue = (value: unknown): DocumentFieldValue | undefined => {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
      return value.map(String);
    }
  }
  return undefined;
};

/** Parses only scalar and scalar-list values from a managed field block. */
export const parseDocumentFieldValues = (source: string): DocumentFieldValues => {
  if (!source.trim()) return {};
  const parsed = parse(source) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("字段块必须使用 YAML 键值格式。");
  }
  const values: DocumentFieldValues = {};
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    const normalized = normalizeValue(rawValue);
    if (normalized === undefined) {
      throw new Error(`字段“${key}”包含暂不支持的嵌套值。`);
    }
    values[key] = normalized;
  }
  return values;
};

export const serializeDocumentFieldValues = (
  values: DocumentFieldValues,
  keyOrder: readonly string[] = [],
): string => {
  const ordered: DocumentFieldValues = {};
  for (const key of keyOrder) {
    if (key in values) ordered[key] = values[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (!(key in ordered)) ordered[key] = value;
  }
  return stringify(ordered, { lineWidth: 0 }).trimEnd();
};

const newlineFor = (content: string): "\r\n" | "\n" =>
  content.includes("\r\n") ? "\r\n" : "\n";

const frontmatterInsertionOffset = (content: string): number => {
  const lines = sourceLines(content);
  if (lines[0]?.text.trim() !== "---") return 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (["---", "..."].includes(lines[index].text.trim())) return lines[index].end;
  }
  return 0;
};

export const updateDocumentFieldValue = (
  content: string,
  key: string,
  value: DocumentFieldValue | undefined,
  keyOrder: readonly string[] = [],
): DocumentFieldBlockUpdate => {
  const blocks = findDocumentFieldBlocks(content);
  if (blocks.length > 1) {
    throw new Error("文档包含多个 Knowledge Suite 字段块，请保留一个后重试。");
  }
  const values = blocks[0] ? parseDocumentFieldValues(blocks[0].source) : {};
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    delete values[key];
  } else {
    values[key] = value;
  }
  const newline = newlineFor(content);
  const serialized = serializeDocumentFieldValues(values, keyOrder).replaceAll("\n", newline);
  if (blocks[0]) {
    const replacement = serialized ? `${serialized}${newline}` : "";
    return {
      content: `${content.slice(0, blocks[0].contentStart)}${replacement}${content.slice(blocks[0].contentEnd)}`,
      createdBlock: false,
      values,
    };
  }

  const insertionOffset = frontmatterInsertionOffset(content);
  const block = [
    `\`\`\`${DOCUMENT_FIELDS_BLOCK_LANGUAGE}`,
    serialized,
    "```",
  ].filter((line, index) => index !== 1 || Boolean(line)).join(newline);
  const before = content.slice(0, insertionOffset);
  const after = content.slice(insertionOffset);
  const separatorBefore = !before
    ? ""
    : before.endsWith(`${newline}${newline}`) ? "" : before.endsWith(newline) ? newline : `${newline}${newline}`;
  const separatorAfter = !after
    ? newline
    : after.startsWith(`${newline}${newline}`) ? "" : after.startsWith(newline) ? newline : `${newline}${newline}`;
  return {
    content: `${before}${separatorBefore}${block}${separatorAfter}${after}`,
    createdBlock: true,
    values,
  };
};
