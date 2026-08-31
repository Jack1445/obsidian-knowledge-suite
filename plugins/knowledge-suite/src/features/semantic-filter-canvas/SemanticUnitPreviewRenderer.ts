import type { BinaryFiles } from "@zsviczian/excalidraw/types/excalidraw/types";
import { getSVG } from "../../utils/utils";
import { materializeSemanticUnitContent } from "../semantic-units/snapshot";
import type { SemanticUnitDefinition } from "../semantic-units/types";

type SemanticPreviewTheme = "light" | "dark";

/** Creates reusable, non-interactive SVG previews from canonical unit content. */
export class SemanticUnitPreviewRenderer {
  private readonly cache = new Map<string, Promise<SVGSVGElement>>();

  public async render(unit: SemanticUnitDefinition, theme: SemanticPreviewTheme): Promise<SVGSVGElement> {
    const cacheKey = `${unit.id}:${unit.revision}:${theme}`;
    let rendered = this.cache.get(cacheKey);
    if (rendered === undefined) {
      rendered = this.createPreview(unit, theme).catch((error: unknown) => {
        this.cache.delete(cacheKey);
        throw error;
      });
      this.cache.set(cacheKey, rendered);
    }
    return (await rendered).cloneNode(true) as SVGSVGElement;
  }

  private async createPreview(unit: SemanticUnitDefinition, theme: SemanticPreviewTheme): Promise<SVGSVGElement> {
    const materialized = materializeSemanticUnitContent(unit.content, { x: 0, y: 0 });
    const files = Object.fromEntries(materialized.files.map((file) => [file.id, file])) as BinaryFiles;
    const svg = await getSVG(
      {
        elements: materialized.elements,
        appState: {
          theme,
          viewBackgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
        },
        files,
      },
      { withBackground: false, withTheme: true, isMask: false },
      18,
      null,
    );
    if (!svg) throw new Error("Unable to render semantic unit preview.");
    svg.addClass("ks-semantic-filter-card__svg");
    svg.setAttribute("focusable", "false");
    return svg;
  }
}
