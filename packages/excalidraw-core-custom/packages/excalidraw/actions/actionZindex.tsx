import { KEYS, CODES, isDarwin } from "@excalidraw/common";

import {
  getCommonBounds,
  getSelectedElements,
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { register } from "./register";

export const VISIBLE_LAYER_STEP = "visible-layer-step";

const boundsOverlap = (
  first: readonly [number, number, number, number],
  second: readonly [number, number, number, number],
) =>
  first[0] <= second[2] &&
  first[2] >= second[0] &&
  first[1] <= second[3] &&
  first[3] >= second[1];

const isConnectorAttachedToSelection = (
  element: ExcalidrawElement,
  selectedIds: Set<ExcalidrawElement["id"]>,
) => {
  if (!("startBinding" in element)) {
    return false;
  }

  return (
    (!!element.startBinding &&
      selectedIds.has(element.startBinding.elementId)) ||
    (!!element.endBinding && selectedIds.has(element.endBinding.elementId))
  );
};

/**
 * Moves the selection across the nearest visually overlapping z-index unit.
 *
 * Excalidraw's native one-step action moves across the next item in the full
 * scene array. On a large canvas that item is commonly elsewhere on the
 * canvas, so the action succeeds without producing a visible change. The
 * compact context-menu layer controls opt into this visual stepping mode while
 * keyboard shortcuts and the native properties panel keep the original
 * global-order semantics.
 */
const moveOneVisibleLayer = (
  elements: readonly ExcalidrawElement[],
  appState: Parameters<typeof moveOneLeft>[1],
  direction: "left" | "right",
  scene: Parameters<typeof moveOneLeft>[2],
) => {
  const selectedElements = getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
    includeElementsInFrames: true,
  });

  if (!selectedElements.length) {
    return elements;
  }

  const selectedIds = new Set(selectedElements.map((element) => element.id));
  const boundElementIds = new Set(
    selectedElements.flatMap(
      (element) => element.boundElements?.map((binding) => binding.id) ?? [],
    ),
  );
  const selectedIndices = elements
    .map((element, index) => (selectedIds.has(element.id) ? index : -1))
    .filter((index) => index !== -1);
  const leadingIndex = selectedIndices[0];
  const trailingIndex = selectedIndices[selectedIndices.length - 1];
  const selectionBounds = getCommonBounds(selectedElements);

  let overlappingTargetId: ExcalidrawElement["id"] | null = null;
  let index = direction === "left" ? leadingIndex - 1 : trailingIndex + 1;
  const step = direction === "left" ? -1 : 1;

  while (index >= 0 && index < elements.length) {
    const candidate = elements[index];
    if (
      !candidate.isDeleted &&
      !selectedIds.has(candidate.id) &&
      !boundElementIds.has(candidate.id) &&
      !isConnectorAttachedToSelection(candidate, selectedIds) &&
      boundsOverlap(selectionBounds, getCommonBounds([candidate]))
    ) {
      overlappingTargetId = candidate.id;
      break;
    }
    index += step;
  }

  if (!overlappingTargetId) {
    return direction === "left"
      ? moveOneLeft(elements, appState, scene)
      : moveOneRight(elements, appState, scene);
  }

  let nextElements = elements;
  for (let attempt = 0; attempt < elements.length; attempt++) {
    const nextSelectedIndices = nextElements
      .map((element, elementIndex) =>
        selectedIds.has(element.id) ? elementIndex : -1,
      )
      .filter((elementIndex) => elementIndex !== -1);
    const targetIndex = nextElements.findIndex(
      (element) => element.id === overlappingTargetId,
    );

    if (
      targetIndex !== -1 &&
      (direction === "left"
        ? nextSelectedIndices[nextSelectedIndices.length - 1] < targetIndex
        : nextSelectedIndices[0] > targetIndex)
    ) {
      return nextElements;
    }

    const movedElements =
      direction === "left"
        ? moveOneLeft(nextElements, appState, scene)
        : moveOneRight(nextElements, appState, scene);
    const orderChanged = movedElements.some(
      (element, elementIndex) => element.id !== nextElements[elementIndex]?.id,
    );
    if (!orderChanged) {
      break;
    }
    nextElements = movedElements;
  }

  // A frame/group boundary can prevent reaching the overlapping target. Avoid
  // leaving the selection at an arbitrary intermediate global z-index.
  return elements;
};

export const actionSendBackward = register({
  name: "sendBackward",
  label: "labels.sendBackward",
  keywords: ["move down", "zindex", "layer"],
  icon: SendBackwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements:
        value === VISIBLE_LAYER_STEP
          ? moveOneVisibleLayer(elements, appState, "left", app.scene)
          : moveOneLeft(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendBackward")} — ${getShortcutKey("CtrlOrCmd+[")}`}
    >
      {SendBackwardIcon}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  label: "labels.bringForward",
  keywords: ["move up", "zindex", "layer"],
  icon: BringForwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements:
        value === VISIBLE_LAYER_STEP
          ? moveOneVisibleLayer(elements, appState, "right", app.scene)
          : moveOneRight(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringForward")} — ${getShortcutKey("CtrlOrCmd+]")}`}
    >
      {BringForwardIcon}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  label: "labels.sendToBack",
  keywords: ["move down", "zindex", "layer"],
  icon: SendToBackIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_LEFT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendToBack")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+[")
          : getShortcutKey("CtrlOrCmd+Shift+[")
      }`}
    >
      {SendToBackIcon}
    </button>
  ),
});

export const actionBringToFront = register({
  name: "bringToFront",
  label: "labels.bringToFront",
  keywords: ["move up", "zindex", "layer"],
  icon: BringToFrontIcon,
  trackEvent: { category: "element" },

  perform: (elements, appState) => {
    return {
      elements: moveAllRight(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_RIGHT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={(event) => updateData(null)}
      title={`${t("labels.bringToFront")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]")
      }`}
    >
      {BringToFrontIcon}
    </button>
  ),
});
