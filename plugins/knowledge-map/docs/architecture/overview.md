# Architecture

Knowledge Map is one Obsidian plugin with replaceable renderers over shared data.

```text
Obsidian Vault + MetadataCache
              |
              v
      VaultGraphBuilder
              |
              v
   FolderGraph (read-only)
       |             |
       v             v
GraphRenderer   KnowledgeMapStore
SVG + input     positions/settings
```

## Source folders

| Folder | Responsibility |
| --- | --- |
| `src/core` | UI-independent graph types, hierarchy-edge rules, and path rules. |
| `src/data` | Plugin data schema, migration, and saving. |
| `src/obsidian` | Translation from Obsidian files and metadata into graph data. |
| `src/services` | Navigation and deterministic hierarchy-layout algorithms. |
| `src/views` | Obsidian `ItemView`, SVG graph renderer, and globe view. |
| `src/integrations` | Optional Excalidraw integration. |
| `src/settings` | User-facing plugin settings. |
| `tests` | Fast tests for rules that do not require the Obsidian app. |

`src/main.ts` intentionally contains only plugin lifecycle, registrations, entry points, and event wiring.
