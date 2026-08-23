# Changelog

All notable changes to Knowledge Map are documented here. Each tested GitHub checkpoint includes a short user-facing summary.

## 0.1.0 - Unreleased

### Added

- Initial Obsidian plugin project and documentation.
- Folder-aware 2D knowledge map.
- Folder drill-down, breadcrumbs, and navigation history.
- Persistent node coordinates and viewport per folder.
- Resolved note-link edges and optional external-link nodes.
- Live refresh for vault and metadata changes.
- Reliable click-versus-drag handling for folder drill-down and note opening.
- Removed the visible Vault root node.
- Added in-canvas node-size and link-thickness controls.
- Added canvas management for blank and graph-seeded native Excalidraw drawings.
- Added a lazy-loaded 3D globe with local Earth/cloud textures and persistent geographic node positions.
- Added live Excalidraw knowledge canvases with default folder maps, same-canvas folder drill-down, navigation history, refresh commands, and vault file/folder drop support.
- Preserved user-created Excalidraw text, icons, shapes, and drawings when the generated folder layer is refreshed or drilled into.
- Added direct click activation for knowledge nodes while preserving normal Excalidraw drag gestures.
- Expanded Obsidian file-explorer drop detection so Markdown files and folders become the same editable circular knowledge nodes.
- Refined Excalidraw knowledge nodes with clean solid borders, low-saturation paper-like fills, calmer type colors, consistent typography, and automatic restyling of existing managed nodes.
- Added per-canvas, per-folder position persistence for generated Excalidraw knowledge nodes, including restoration after drill-down, back navigation, refresh, and reopening.
- Restored gently bowed three-point Excalidraw connections for a softer knowledge-map appearance; the fixed reset-layout action can rebuild them if repeated manual dragging distorts a bend point.
- Added **Reset knowledge layout** to Excalidraw's three-dot tool menu, plus a matching command that restores the current folder's generated layer without removing manual canvas content. The menu option appears only in registered Knowledge Map canvases.
- Added a Knowledge-main-style LaTeX editor to knowledge canvases with live preview, syntax highlighting, five symbol palettes, insertion/editing, double-click editing, and Ctrl/Cmd+Shift+M.
- Added whole-element visual bold for standalone Excalidraw text in knowledge canvases, including a real **B** option in the existing font row and Ctrl/Cmd+B. Bold state is stored in the drawing and kept aligned when text moves or changes.

### Fixed

- Kept existing LaTeX source visible when reopening a formula for editing.
- Restored **Insert/Edit formula** and **Reset knowledge layout** after reloading the plugin without restarting Obsidian.

### Changed — folder hierarchy and canvas entry points

- Removed the synthetic `..` parent-folder node; toolbar history and breadcrumbs handle upward navigation.
- Replaced scattered automatic placement with a stable hierarchy layout: current folder above, naturally sorted direct children below.
- Added containment edges from the current folder to every direct child folder and note.
- Added separate ribbon icons and clearer command-palette actions for the 2D map, globe, and canvas manager.
- Added visible **Globe** and **Canvases** buttons to the 2D map toolbar.
- Made 2D/globe entry actions focus an already-open target tab instead of only updating it in the background.
- Preserved positions for nodes the user has manually dragged and fixed.
- Added safe visual truncation and full-name tooltips so long labels do not overlap in the ordered row.

### Changed — relationship lines

- Replaced straight SVG lines with smooth curves that update live while nodes are dragged.
- Styled folder-containment relationships as solid warm-orange curves.
- Styled note-reference relationships as dashed blue arcs so hierarchy and links remain visually distinct.
- Added a compact, context-aware legend that only shows relationship types present in the current map.
