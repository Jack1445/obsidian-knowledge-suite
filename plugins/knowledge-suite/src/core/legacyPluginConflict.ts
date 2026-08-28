import type { App } from "obsidian";

export const LEGACY_PLUGIN_IDS = [
  "obsidian-excalidraw-plugin",
  "knowledge-map",
] as const;

const LEGACY_PLUGIN_NAMES: Record<(typeof LEGACY_PLUGIN_IDS)[number], string> = {
  "obsidian-excalidraw-plugin": "Excalidraw (obsidian-excalidraw-plugin)",
  "knowledge-map": "Knowledge Map (knowledge-map)",
};

/**
 * Returns enabled legacy plugins that would compete with Knowledge Suite for
 * views, commands, global APIs, or persisted state.
 */
export const getEnabledLegacyPluginNames = (app: App): string[] =>
  LEGACY_PLUGIN_IDS.filter((id) => app.plugins.plugins[id] !== undefined).map(
    (id) => LEGACY_PLUGIN_NAMES[id],
  );
