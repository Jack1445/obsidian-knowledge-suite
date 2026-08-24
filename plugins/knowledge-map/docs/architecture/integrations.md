# Integrations

## Excalidraw

Knowledge Map does not copy or bundle the Obsidian Excalidraw plugin. Excalidraw is a large, independently maintained AGPL-3.0 plugin with its own view registrations, commands, settings, optional network features, and scripting system. Bundling it inside Knowledge Map would create duplicate registrations and turn this repository into an Excalidraw fork.

Instead, `src/integrations/excalidraw.ts` uses the installed plugin's public `window.ExcalidrawAutomate` API. It can:

- create an empty native Excalidraw drawing;
- create a live knowledge canvas pre-populated from the current folder graph;
- register per-view pointer and drop behavior without changing the Excalidraw plugin;
- replace only generated map elements during folder drill-down while preserving user-created elements;
- add folders as drillable elements and Markdown notes as directly clickable knowledge elements;
- convert vault file/folder drops into editable knowledge nodes;
- append a reset-layout option to the three-dot tool menu of registered knowledge-canvas views;
- append an insert/edit formula option to that same tool menu;
- render formulas with the bundled KaTeX parser and insert a self-contained MathML SVG through ExcalidrawAutomate's public addImage API;
- add a scoped whole-text bold control without changing Excalidraw's element schema;
- leave text, icons, shapes, free drawing, export, themes, and other canvas behavior to Excalidraw itself.

Generated elements carry `customData.knowledgeMap` metadata. `scope: "map"` identifies the refreshable folder layer, while `scope: "manual"` identifies nodes the user explicitly dropped onto the canvas. Every folder node opens a separate child Knowledge Canvas so its destination graph never contaminates the source drawing. Parent paths and canvas registration live in Knowledge Map's own plugin data; Back returns to the exact parent and no Root navigation element is generated. Existing Excalidraw files that were not created as knowledge canvases remain untouched.

The Canvas tree is a dedicated Obsidian `ItemView`. It builds a virtual hierarchy from the same parent paths, so nesting is independent of the vault's physical folder structure. Store subscriptions refresh open tree views when relationships change; missing-parent and cyclic records remain visible as top-level entries instead of disappearing.

Knowledge Map listens for short, unmoved pointer clicks in registered knowledge-canvas views, so clicking a managed circle or label activates it directly from its custom data. A pointer gesture that moves more than the click threshold remains an ordinary Excalidraw drag. Managed elements do not carry Excalidraw links, avoiding redundant link-indicator icons; older managed elements have those links removed when their knowledge canvas binds.

The reset-layout control is inserted as a real `.dropdown-menu-item` inside Excalidraw's rendered three-dot tool menu. A scoped observer reinserts the option whenever Excalidraw rebuilds or reopens its React-owned menu DOM, and the option is removed when the view unloads. This changes neither Excalidraw's source nor ordinary Excalidraw views.

Formula and reset-layout controls are real options inside Excalidraw's rendered three-dot tool menu. The bold button is inserted into Excalidraw's rendered font-family option row. Scoped observers reinsert the controls whenever Excalidraw rebuilds its React-owned menu DOM, and all controls are removed when the view unloads. This changes neither Excalidraw's source nor ordinary Excalidraw views.

Excalidraw 2.26.x does not expose a native fontWeight property for text elements. Knowledge Map therefore represents whole-element bold as a locked, slightly offset companion text element. customData.knowledgeMapTextStyle links the source and companion, and the scene-change hook synchronizes their content and geometry. This is intentionally limited to standalone text and can later be migrated if Excalidraw adds native text weights.

Formula elements use the bundled KaTeX parser and Excalidraw's ordinary data-URL image pipeline. The symbol palette, live preview, and exported SVG therefore share one deterministic renderer and do not depend on Obsidian's asynchronous MathJax lifecycle. This avoids the optional Excalidraw Extras dependency while preserving normal export and persistence. Knowledge Map stores the original source in customData.latex and marks formulas as manual content, ensuring folder refresh and drill-down never remove them.

This integration requires the user to install and enable **Excalidraw** separately. If it is unavailable, Knowledge Map displays a notice instead of failing.

References:

- <https://github.com/zsviczian/obsidian-excalidraw-plugin>
- <https://zsviczian.github.io/obsidian-excalidraw-plugin/>
- <https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts>

## Globe renderer

The globe renderer is native to Knowledge Map and lazy-loads Three.js only when the globe view opens. Its coordinate conversion and interaction rules were adapted from the user's local `Knowledge-main` project. The bundled day and cloud textures were copied from that same project and should retain their original provenance records before public distribution.
