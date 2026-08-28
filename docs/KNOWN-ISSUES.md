# Known issues

## Resolved in v1.1.0

### BUG-001 — Inline-formula suffix text hidden while editing

- **Reproduction:** Type text, insert an inline formula in the middle, finish editing, then double-click the text again.
- **Previous behavior:** A formula wider than its source placeholder covered the following text and intercepted pointer selection.
- **Fixed behavior:** The editing overlay follows the native source-text geometry and fits the formula preview inside its source range, preserving the visible and selectable suffix.
- **Regression coverage:** `packages/excalidraw-core-custom/packages/element/tests/inlineTextStyle.test.ts`.

### BUG-002 — Folder navigation polluted the source canvas and lost its parent

- **Reproduction:** Drag a folder into a Knowledge Canvas, click the dropped folder, then use Back.
- **Previous behavior:** The dropped node reused generated-layer navigation, expanding the folder in the source drawing and later stacking the root map into it.
- **Fixed behavior:** Every folder opens or reuses an independent child canvas. Its persisted parent relationship drives Back navigation; Root is not generated and the source drawing is not modified.
- **Regression coverage:** `plugins/knowledge-map/tests/knowledge-canvas-model.test.ts` and `plugins/knowledge-map/tests/knowledge-canvas-store.test.ts`.
