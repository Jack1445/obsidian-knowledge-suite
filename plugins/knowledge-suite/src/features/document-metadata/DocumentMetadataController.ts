import { type App } from "obsidian";
import type ExcalidrawPlugin from "../../core/main";
import type { KnowledgeSuiteDataNamespace } from "../../core/KnowledgeSuiteDataCoordinator";
import { DOCUMENT_FIELDS_BLOCK_LANGUAGE } from "./fieldBlock";
import { DocumentMetadataService } from "./DocumentMetadataService";
import { createDocumentFieldsEditorExtension } from "./editorExtension";
import { MarkdownFieldPanel } from "./MarkdownFieldPanel";
import type { DocumentMetadataData } from "./types";
import type SemanticUnitController from "../semantic-units/SemanticUnitController";
import {
  DOCUMENT_METADATA_MANAGER_VIEW_TYPE,
  DocumentMetadataManagerView,
} from "./views/DocumentMetadataManagerView";

export default class DocumentMetadataController {
  public readonly service: DocumentMetadataService;

  constructor(
    public readonly host: ExcalidrawPlugin,
    persistence: KnowledgeSuiteDataNamespace<DocumentMetadataData>,
    public readonly semanticUnits: SemanticUnitController | null,
  ) {
    this.service = new DocumentMetadataService(host.app, host, persistence);
  }

  get app(): App {
    return this.host.app;
  }

  async initialize(): Promise<void> {
    await this.service.initialize();
    this.host.registerView(
      DOCUMENT_METADATA_MANAGER_VIEW_TYPE,
      (leaf) => new DocumentMetadataManagerView(leaf, this),
    );
    this.host.addRibbonIcon("table-properties", "知识管理", () => {
      void this.activateManager();
    });
    this.host.addCommand({
      id: "open-document-metadata-manager",
      name: "打开知识管理",
      callback: () => void this.activateManager(),
    });
    this.host.registerEditorExtension(createDocumentFieldsEditorExtension(this));
    this.host.registerMarkdownPostProcessor((el, context) => {
      const root = el.closest(".markdown-preview-sizer");
      if (!root?.instanceOf(HTMLElement)) return;
      if (root.querySelector(":scope > .ks-document-fields--automatic")) return;
      const container = root.createDiv({
        cls: "ks-document-fields-widget ks-document-fields--automatic",
      });
      root.prepend(container);
      context.addChild(new MarkdownFieldPanel(container, context.sourcePath, this, true));
    });
    this.host.registerMarkdownCodeBlockProcessor(
      DOCUMENT_FIELDS_BLOCK_LANGUAGE,
      (_source, el, _context) => {
        el.empty();
        el.addClass("ks-document-fields-source-placeholder");
      },
    );
  }

  async activateManager(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(DOCUMENT_METADATA_MANAGER_VIEW_TYPE)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: DOCUMENT_METADATA_MANAGER_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  destroy(): void {
    this.app.workspace.detachLeavesOfType(DOCUMENT_METADATA_MANAGER_VIEW_TYPE);
  }
}
