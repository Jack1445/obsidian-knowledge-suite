import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { getCommonBoundingBox, restoreElements } from "src/constants/constants";
import { getEA } from "src/core";
import { t } from "src/lang/helpers";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { errorlog } from "./utils";

function estimateBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  const bb = getCommonBoundingBox(elements);
  return [bb.minX, bb.minY, bb.maxX, bb.maxY];
}

export function repositionElementsToCursor(
  elements: ExcalidrawElement[],
  newPosition: { x: number; y: number },
  center: boolean = false,
): ExcalidrawElement[] {
  const [x1, y1, x2, y2] = estimateBounds(elements);
  let [offsetX, offsetY] = [0, 0];
  if (center) {
    [offsetX, offsetY] = [
      newPosition.x - (x1 + x2) / 2,
      newPosition.y - (y1 + y2) / 2,
    ];
  } else {
    [offsetX, offsetY] = [newPosition.x - x1, newPosition.y - y1];
  }

  elements.forEach((element: Mutable<ExcalidrawElement>) => {
    element.x = element.x + offsetX;
    element.y = element.y + offsetY;
  });

  return restoreElements(elements, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
}

export const cloneElement = (
  el: ExcalidrawElement,
): Mutable<ExcalidrawElement> => {
  const newEl = JSON.parse(JSON.stringify(el)) as Mutable<ExcalidrawElement>;
  newEl.version = el.version + 1;
  newEl.updated = Date.now();
  newEl.versionNonce = Math.floor(Math.random() * 1000000000);
  return newEl;
};

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container.boundElements.find((ele) => ele.type === "text")?.id || null
    : null;
};

export const insertLaTeXToView = (
  view: ExcalidrawView,
  center: boolean = false,
) => {
  const ea = getEA(view);
  void view.plugin
    .editInlineFormula("")
    .then(async (rendered) => {
      if (!rendered) {
        return;
      }
      const id = await ea.addImage(0, 0, rendered.dataURL, false, false);
      if (!id) {
        return;
      }
      const element = ea.getElement(id) as Mutable<ExcalidrawImageElement>;
      if (!element) {
        return;
      }
      element.width = rendered.width;
      element.height = rendered.height;
      const image = ea.imagesDict[element.fileId];
      if (image) {
        image.dataURL = rendered.dataURL as DataURL;
        image.latex = rendered.latex;
        image.size = { width: rendered.width, height: rendered.height };
      }
      ea.addAppendUpdateCustomData(id, {
        latex: rendered.latex,
        latexscale: { scaleX: 1, scaleY: 1 },
      });
      if (center) {
        const { x, y } = ea.getViewCenterPosition();
        element.x = x - element.width / 2;
        element.y = y - element.height / 2;
      }
      await ea.addElementsToView(!center, false, true);
      ea.selectElementsInView([id]);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        errorlog({ message: "LaTeX insertion aborted", error });
      }
    })
    .finally(() => ea.destroy());
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea
    .getViewElements()
    .filter(
      (el) =>
        el.type === "text" ||
        el.type === "frame" ||
        el.link ||
        el.type === "image",
    );
  if (elements.length === 0) {
    return;
  }
  const { ScriptEngine } = await import("src/shared/Scripts");
  let text = await ScriptEngine.inputPrompt(
    view,
    view.plugin,
    view.plugin.app,
    "Search for",
    "use quotation marks for exact match",
    "",
  );
  if (!text) {
    return;
  }
  const res = text.matchAll(/"(.*?)"/g);
  let query: string[] = [];
  let parts;
  while (!(parts = res.next()).done) {
    query.push(parts.value[1]);
  }
  text = text.replaceAll(/"(.*?)"/g, "");
  query = query.concat(text.split(" ").filter((s: string) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};
