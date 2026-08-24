# Changelog

All notable changes to Knowledge Map are documented here. Each tested GitHub checkpoint includes a short user-facing summary.

## Stage 0 accepted baseline - 2026-08-24

This GitHub checkpoint freezes the version accepted in Obsidian before the context-menu redesign begins.

### Excalidraw text editing

- Fixed inline formulas hiding or displacing the text that follows them when native text editing starts.
- Kept suffix text editable, deletable, mouse-selectable, and compatible with partial bold formatting.
- Restored complete formula source text when older raw-text caches contain a truncated value.

### Canvas files and navigation

- Added independent persistent files for both 2D and 3D canvases.
- Added persistent parent/child canvas relationships without moving canvas files on disk.
- Kept references independent from structural parent/child relationships.
- Made child-canvas Back navigation return to the exact parent canvas, preserving an already-open parent's viewport and centering the entry node only when the parent must be reopened.
- Treated dropped folders as independent child-canvas entry points instead of replacing the source canvas content.
- Added file and folder drops to 3D canvases, with persisted globe positions.

### Canvas tree

- Added an infinitely nestable Canvas tree for 2D and 3D canvases.
- Added collapsible reference folders with outgoing, incoming, and reciprocal direction indicators.
- Added right-click file operations and direct canvas opening from the tree.
- Added same-level drag sorting for roots and siblings, with independent persisted order for every parent canvas.
- Kept reference folders fixed after structural children and excluded them from manual sorting.

### Interface

- Localized Knowledge Map commands and management surfaces into Chinese while retaining the plugin name **Knowledge Map**.
- Simplified the left sidebar to **Manage canvases** and **Open Canvas tree**.
- Redesigned the canvas manager around 2D and 3D canvas creation and removed the plain-canvas creation card.
- Added recognizable 2D network and 3D globe nodes when managed canvases are dropped into a 2D canvas.

## Stage 1 accepted checkpoint - 2026-08-24

- Made canvas-node context menus use Excalidraw's precise pointer hit testing instead of the previously selected element.
- Direct right-click now identifies the exact 2D or 3D canvas node under the pointer without requiring preselection.
- Right-clicking blank canvas no longer reuses a stale managed-canvas selection.
- Added compatibility fallback behavior for older Excalidraw builds that do not expose pointer hit testing.

## 0.1.0 - Unreleased

### Added

- Initial Obsidian plugin project and documentation.
- Added a left-sidebar **Canvas tree** that presents persisted parent/child canvases as an infinitely nestable hierarchy without moving their files.
- Restyled **Canvas tree** with compact rows, canvas icons, active highlighting, child counts, and rounded hierarchy connector curves.
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
- Added live Excalidraw knowledge canvases with default folder maps, persistent parent/child canvas navigation, refresh commands, and vault file/folder drop support.
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
- Manually dropped folders now open an independent folder Knowledge Canvas instead of expanding into and polluting the source drawing and its back-navigation state.
- Folder navigation now creates or reopens persistent child canvases. Child canvases show only **Back**, which returns to their parent canvas; the obsolete **Root** chip is no longer generated.

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
