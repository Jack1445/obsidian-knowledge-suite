import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type DocumentMetadataController from "./DocumentMetadataController";
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
    return false;
  }
}

const buildDecorations = (
  controller: DocumentMetadataController,
  state: EditorState,
): DecorationSet => {
  const file = state.field(editorInfoField, false)?.file ?? null;
  if (!controller.service.isManagedMarkdownFile(file)) return Decoration.none;
  return Decoration.set([
    Decoration.widget({
      widget: new DocumentFieldsWidget(controller, file.path),
      block: true,
      side: -1,
    }).range(0),
  ]);
};

export const createDocumentFieldsEditorExtension = (
  controller: DocumentMetadataController,
) => StateField.define<DecorationSet>({
  create: (state) => buildDecorations(controller, state),
  update: (decorations, transaction) => {
    const previousPath = transaction.startState.field(editorInfoField, false)?.file?.path ?? null;
    const nextPath = transaction.state.field(editorInfoField, false)?.file?.path ?? null;
    return previousPath === nextPath
      ? decorations.map(transaction.changes)
      : buildDecorations(controller, transaction.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});
