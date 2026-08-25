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

## Stage 2 accepted checkpoint - 2026-08-25

- Routed direct right-click by node type: managed 2D/3D canvases, folders, vault files, and ordinary Excalidraw elements now receive their appropriate menus.
- Added file-node actions for opening, opening in a new tab, revealing in the file list, copying the vault path, and Obsidian file-menu extensions.
- Added folder-node actions for opening persistent child canvases and explicitly setting or clearing the structural child relationship.
- Kept folder-canvas references after clearing a parent relationship so reopening a folder does not create a duplicate canvas.
- Recognized the generated current-folder node separately and prevented the current canvas from becoming its own child.
- Preserved Excalidraw's native context menu for ordinary shapes and blank canvas areas.

## Stage 3A accepted checkpoint - 2026-08-25

- Restyled Excalidraw's native context menu as a compact, flat Obsidian-style panel.
- Reduced menu width and row height while refining borders, shadows, separators, hover states, shortcuts, and the scrollbar.
- Removed the previous gradient surface, accent side bars, and pill-shaped shortcut labels.
- Shortened verbose Simplified Chinese action labels and removed mixed Chinese/English wording without changing menu commands or ordering.

## Stage 3B accepted checkpoint - 2026-08-25

- Combined the four z-index commands into one compact icon row ordered as send to back, move backward, move forward, and bring to front.
- Added localized accessible labels and shortcut tooltips while keeping the icon row keyboard- and screen-reader-friendly.
- Made context-menu move-backward and move-forward cross the nearest visually overlapping object instead of an unrelated off-screen scene element.
- Excluded a node's bound text and attached connectors from visual-layer targets, while preserving Excalidraw's native keyboard and properties-panel ordering behavior.

## Stage 4A accepted checkpoint - 2026-08-25

- Added distinct compact context-menu headers for 2D canvases, 3D canvases, folder canvases, current folders, and ordinary vault files.
- Gave each managed node type its own icon and accent color while keeping the menu aligned with Obsidian's native visual language.
- Grouped open, relationship, and information commands into clearer sections and refined their labels and icons.
- Forced managed-node actions to use the styled DOM menu so the same appearance is preserved across platforms.

## Stage 4B accepted checkpoint - 2026-08-25

- Added persistent color and shape controls to managed 2D, 3D, and folder-canvas node menus.
- Added compact common-color swatches plus an expandable palette with additional presets.
- Added a centered custom-color dialog with live preview, hexadecimal input, and explicit Confirm and Cancel actions.
- Saved up to twelve per-vault custom colors under My colors, with right-click removal and automatic deduplication.
- Derived coordinated node backgrounds and readable text colors from custom colors while preserving the chosen accent.
- Preserved node appearance across drawing reloads, Obsidian restarts, and generated folder-map refreshes.

## Stage 4C accepted checkpoint - 2026-08-25

- Added persistent icon controls to managed 2D canvases, 3D canvases, folders, and ordinary file nodes.
- Integrated Obsidian's built-in Lucide library with full search and compact expandable featured results.
- Added a curated expandable Emoji collection plus custom short-character icons.
- Kept Lucide SVG icons synchronized with node colors and preserved them across map refreshes and reloads.
- Unified the custom-color and icon dialogs with a compact card layout and simplified Confirm and Cancel actions.
- Rebuilt managed folder and file nodes safely when their icon representation changes.

## Stage 5 accepted checkpoint - 2026-08-25

- Completed source, version, license, and embedded-Core signature verification for the full suite.
- Passed all 10 Excalidraw Core inline-style tests and all 55 Knowledge Map tests, plus TypeScript and ESLint checks.
- Completed a clean production build of Excalidraw Core, Excalidraw Custom, and Knowledge Map.
- Verified SHA-256 equality between all staged plugin artifacts and the files deployed to the acceptance Vault.
- Produced the accepted `obsidian-knowledge-suite-v1.0.0.zip` release package.

## Stage 6 accepted checkpoint - 2026-08-25

- Reworked the 3D canvas background with layered nebula gradients and a denser colored WebGL star field.
- Replaced low-contrast globe labels with readable icon-and-title nodes for files, folders, 2D canvases, and 3D canvases.
- Added the same persistent color, shape, custom-color, and icon controls used by managed 2D nodes.
- Added direct 3D node context menus for opening files and canvases and managing parent-child canvas relationships.
- Persisted 3D node appearance and dimensions inside each `.canvas3d` document with backward-compatible parsing.
- Restored the accepted horizontal node layout and added independent resizing from all four edges while preserving center-drag geographic movement.

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
