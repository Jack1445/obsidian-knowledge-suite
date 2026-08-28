import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { PDFPageViewProps } from "src/types/embeddedFileLoaderTypes";
import type { KnowledgeCanvasElementData } from "src/features/knowledge-map/integrations/knowledge-canvas-model";

export const KNOWLEDGE_CANVAS_DATA_KEY = "knowledgeMap";

export type ExcalidrawCustomDataValue =
  | string
  | number
  | boolean
  | null
  | ExcalidrawCustomDataValue[]
  | { [key: string]: ExcalidrawCustomDataValue };

export type ExcalidrawCustomData = Record<
  string,
  ExcalidrawCustomDataValue | undefined
>;

export type ExcalidrawCustomDataPatch = Partial<ExcalidrawCustomData>;

export type ExcalidrawPDFCustomData = ExcalidrawCustomData & {
  pdfPageViewProps?: PDFPageViewProps;
};

export type ExcalidrawLatexCustomData = ExcalidrawCustomData & {
  latex?: string;
  latexscale?: number;
};

export type ExcalidrawKnowledgeCanvasCustomData = ExcalidrawCustomData & {
  [KNOWLEDGE_CANVAS_DATA_KEY]?: KnowledgeCanvasElementData;
};

export type ExcalidrawImageWithCustomData<
  TCustomData extends ExcalidrawCustomData = ExcalidrawCustomData,
> = ExcalidrawImageElement & {
  customData?: TCustomData;
};

export function addAppendUpdateCustomData(
  el: Mutable<ExcalidrawElement>,
  newData: ExcalidrawCustomDataPatch,
): ExcalidrawElement {
  if (!newData) {
    return el;
  }
  if (!el.customData) {
    el.customData = {};
  }
  for (const key in newData) {
    if (typeof newData[key] === "undefined") {
      delete el.customData[key];
      continue;
    }
    el.customData[key] = newData[key];
  }
  return el;
}

export function readKnowledgeCanvasData(element: {
  customData?: unknown;
}): KnowledgeCanvasElementData | null {
  if (!element.customData || typeof element.customData !== "object") {
    return null;
  }
  const value = (element.customData as Record<string, unknown>)[
    KNOWLEDGE_CANVAS_DATA_KEY
  ];
  if (!value || typeof value !== "object") {
    return null;
  }
  const data = value as Partial<KnowledgeCanvasElementData>;
  return data.managed === true &&
    typeof data.scope === "string" &&
    typeof data.role === "string"
    ? (data as KnowledgeCanvasElementData)
    : null;
}

export type ExcalidrawInlineFormulaCustomData = ExcalidrawCustomData & {
  obsidianInlineFormulas?: {
    version: 1;
    items: {
      latex: string;
      dataURL: string;
      width: number;
      height: number;
    }[];
  };
};
