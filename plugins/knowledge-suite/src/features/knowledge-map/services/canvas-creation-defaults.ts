import type { KnowledgeCanvasType, KnowledgeMapSettings } from "../data/schema";
import { folderDisplayName, normalizeFolderPath } from "../core/paths";

const INVALID_FILENAME_CHARACTERS = /[\\/:*?"<>|]/g;
const CANVAS_FILE_EXTENSION = /\.(?:excalidraw\.md|knowledge-globe|md)$/i;

function configuredValue(
  canvasType: KnowledgeCanvasType,
  settings: KnowledgeMapSettings,
  kind: "name" | "folder",
): string {
  const value =
    canvasType === "2d"
      ? kind === "name"
        ? settings.default2dCanvasName
        : settings.default2dCanvasFolder
      : kind === "name"
        ? settings.default3dCanvasName
        : settings.default3dCanvasFolder;
  return value.trim();
}

/** Returns a safe base filename while preserving the historical name when unset. */
export function resolveCanvasBaseName(
  canvasType: KnowledgeCanvasType,
  contentFolderPath: string,
  settings: KnowledgeMapSettings,
  now = new Date(),
  fallbackPrefix?: string,
): string {
  const configuredName = configuredValue(canvasType, settings, "name")
    .replace(CANVAS_FILE_EXTENSION, "")
    .replace(INVALID_FILENAME_CHARACTERS, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  if (configuredName) return configuredName;

  const timestamp = now
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", " ")
    .slice(0, 19);
  const prefix =
    fallbackPrefix ??
    `${folderDisplayName(contentFolderPath)} ${canvasType === "3d" ? "3维" : "2维"}画布`;
  return `${prefix} ${timestamp}`;
}

/**
 * Resolves the storage folder separately from the folder visualized by a
 * managed canvas. Undefined preserves the historical 2D root-folder behavior.
 */
export function resolveCanvasStorageFolder(
  canvasType: KnowledgeCanvasType,
  contentFolderPath: string,
  settings: KnowledgeMapSettings,
): string | undefined {
  const configuredFolder = configuredValue(canvasType, settings, "folder");
  if (configuredFolder) return normalizeFolderPath(configuredFolder);

  const normalizedContentFolder = normalizeFolderPath(contentFolderPath);
  if (canvasType === "2d" && normalizedContentFolder === "/") return undefined;
  return normalizedContentFolder;
}
