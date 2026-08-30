import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import type DocumentMetadataController from "./DocumentMetadataController";
import { findDocumentFieldBlocks } from "./fieldBlock";
import { MarkdownFieldPanel } from "./MarkdownFieldPanel";

class DocumentFieldsWidget extends WidgetType {
  private panel: MarkdownFieldPanel | null = null;

  constructor(
    private readonly controller: DocumentMetadataController,
    private readonly sourcePath: string,
  ) {
    super();
  }

  eq(other: DocumentFieldsWidget): boolean {
    return other.controller === this.controller && other.sourcePath === this.sourcePath;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = view.dom.ownerDocument.createElement("div");
    container.className = "ks-document-fields-widget ks-document-fields--automatic";
    const file = this.controller.app.vault.getFileByPath(this.sourcePath);
    if (!this.controller.service.isManagedMarkdownFile(file)) {
      container.hidden = true;
      return container;
    }
    this.panel = new MarkdownFieldPanel(container, file.path, this.controller, true);
    this.panel.load();
    return container;
  }

  destroy(): void {
    this.panel?.unload();
    this.panel = null;
  }

  ignoreEvent(): boolean {
    // The panel contains native form controls. Let them handle pointer and
    // keyboard events instead of allowing CodeMirror to move the text cursor.
    return true;
  }
}

const buildDecorations = (
  controller: DocumentMetadataController,
  state: EditorState,
): DecorationSet => {
  const file = state.field(editorInfoField, false)?.file ?? null;
  if (!controller.service.isManagedMarkdownFile(file)) return Decoration.none;
  const decorations = [
    Decoration.widget({
      widget: new DocumentFieldsWidget(controller, file.path),
      block: true,
      side: -1,
    }).range(0),
  ];
  if (state.field(editorLivePreviewField, false) === true) {
    for (const block of findDocumentFieldBlocks(state.doc.toString())) {
      decorations.push(Decoration.replace({ block: true }).range(block.start, block.end));
    }
  }
  return Decoration.set(decorations, true);
};

export const createDocumentFieldsEditorExtension = (
  controller: DocumentMetadataController,
) => StateField.define<DecorationSet>({
  create: (state) => buildDecorations(controller, state),
  update: (decorations, transaction) => {
    const previousPath = transaction.startState.field(editorInfoField, false)?.file?.path ?? null;
    const nextPath = transaction.state.field(editorInfoField, false)?.file?.path ?? null;
    const previousLivePreview = transaction.startState.field(editorLivePreviewField, false) ?? false;
    const nextLivePreview = transaction.state.field(editorLivePreviewField, false) ?? false;
    if (
      previousPath === nextPath &&
      previousLivePreview === nextLivePreview &&
      !transaction.docChanged
    ) {
      return decorations;
    }
    return buildDecorations(controller, transaction.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});
