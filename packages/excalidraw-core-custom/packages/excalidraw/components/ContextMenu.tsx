import clsx from "clsx";
import React from "react";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import { useAppProps, useExcalidrawAppState, useExcalidrawElements } from "./App";

import { Popover } from "./Popover";

import "./ContextMenu.scss";

import type { ActionManager } from "../actions/manager";
import type { ShortcutName } from "../actions/shortcuts";
import type { Action } from "../actions/types";

import type { TranslationKeys } from "../i18n";
import { VISIBLE_LAYER_STEP } from "../actions/actionZindex";

const Z_INDEX_ACTION_NAMES = new Set<Action["name"]>([
  "sendToBack",
  "sendBackward",
  "bringForward",
  "bringToFront",
]);

export type ContextMenuItem = typeof CONTEXT_MENU_SEPARATOR | Action;

export type ContextMenuItems = (ContextMenuItem | false | null | undefined)[];

type ContextMenuProps = {
  actionManager: ActionManager;
  items: ContextMenuItems;
  top: number;
  left: number;
  onClose: (callback?: () => void) => void;
};

export const CONTEXT_MENU_SEPARATOR = "separator";

export const ContextMenu = React.memo(
  ({ actionManager, items, top, left, onClose }: ContextMenuProps) => {
    const appState = useExcalidrawAppState();
    const elements = useExcalidrawElements();
    const { onContextMenu } = useAppProps(); //zsviczian

    const filteredItems = items.reduce((acc: ContextMenuItem[], item) => {
      if (
        item &&
        (item === CONTEXT_MENU_SEPARATOR ||
          !item.predicate ||
          item.predicate(
            elements,
            appState,
            actionManager.app.props,
            actionManager.app,
          ))
      ) {
        acc.push(item);
      }
      return acc;
    }, []);

    const getActionLabel = (item: Action) => {
      const label =
        typeof item.label === "function"
          ? item.label(elements, appState, actionManager.app)
          : item.label;
      return t(label as unknown as TranslationKeys);
    };

    return (
      <Popover
        onCloseRequest={() => {
          onClose();
        }}
        top={top}
        left={left}
        fitInViewport={true}
        viewportWidth={appState.width}
        viewportHeight={appState.height}
        className="context-menu-popover"
      >
        <ul
          className="context-menu excalidraw-context-menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {
            onContextMenu &&
              onContextMenu?.(elements, appState, onClose) /*zsviczian*/
          }
          {filteredItems.map((item, idx) => {
            if (item === CONTEXT_MENU_SEPARATOR) {
              if (
                !filteredItems[idx - 1] ||
                filteredItems[idx - 1] === CONTEXT_MENU_SEPARATOR
              ) {
                return null;
              }
              return <hr key={idx} className="context-menu-item-separator" />;
            }

            const actionName = item.name;
            const label = getActionLabel(item);
            if (Z_INDEX_ACTION_NAMES.has(actionName)) {
              const shortcut = getShortcutFromShortcutName(
                actionName as ShortcutName,
              );
              const icon =
                typeof item.icon === "function"
                  ? item.icon(appState, elements)
                  : item.icon;
              return (
                <li
                  key={idx}
                  data-testid={actionName}
                  className="context-menu-layer-action"
                >
                  <button
                    type="button"
                    className="context-menu-layer-action__button"
                    aria-label={label}
                    title={shortcut ? `${label} · ${shortcut}` : label}
                    onClick={() => {
                      onClose(() => {
                        actionManager.executeAction(
                          item,
                          "contextMenu",
                          actionName === "sendBackward" ||
                            actionName === "bringForward"
                            ? VISIBLE_LAYER_STEP
                            : null,
                        );
                      });
                    }}
                  >
                    {icon}
                    <span className="context-menu-layer-action__label">
                      {label}
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li
                key={idx}
                data-testid={actionName}
                onClick={() => {
                  // we need update state before executing the action in case
                  // the action uses the appState it's being passed (that still
                  // contains a defined contextMenu) to return the next state.
                  onClose(() => {
                    actionManager.executeAction(item, "contextMenu");
                  });
                }}
              >
                <button
                  type="button"
                  className={clsx("context-menu-item", {
                    dangerous: actionName === "deleteSelectedElements",
                    checkmark: item.checked?.(appState),
                  })}
                >
                  <div className="context-menu-item__label">{label}</div>
                  <kbd className="context-menu-item__shortcut">
                    {actionName
                      ? getShortcutFromShortcutName(actionName as ShortcutName)
                      : ""}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    );
  },
);
