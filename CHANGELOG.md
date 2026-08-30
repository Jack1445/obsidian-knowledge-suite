# Changelog

## Unreleased

- 修复显示元素单位内容后移动画布元素会使紫色高亮错位的问题；下一次拖拽、滚轮或键盘交互会立即收起一次性高亮。
- 修复语义单位在目标画布首次打开时可能因场景初始化竞态而延迟到第二次打开才补同步的问题。
- 修复修改源画布后立即 Ctrl+S 并退出时，防抖任务来不及登记修订而导致其他画布反复打开才同步的问题；保存、关闭和激活画布现在都会执行对应检查。
- 画布语义单位新增非破坏性的实例锁定、画布状态层右键解锁，以及管理页锁定筛选和批量切换；不会写入原生锁定或删除字段，也不提供隐藏、快捷键删除恢复功能。

- Established the canvas semantic-unit safety baseline and versioned data model without scanning or rewriting existing canvases.
- Added an isolated `semanticUnits` persistence namespace, canonical definitions, explicitly registered instances, revision conflict protection, and data-only dissolve semantics.
- Added verified byte-for-byte canvas backups and source hash checks as a mandatory safety gate for future semantic-unit canvas writes.
- Defined semantic identity through per-canvas element ID mappings so ordinary Ctrl+C/V copies remain unrelated visual elements.
- Unified the existing management entry under a compact Knowledge Management view with separate Markdown metadata and canvas semantic-unit sections.
- Added a confirmed row context-menu action for deleting a semantic-unit definition and its registrations while explicitly preserving every canvas element, Markdown document, and attachment.
- Added the first non-destructive 2D semantic-unit workflow: create a named unit from selected elements, optionally bind one Markdown file, highlight registered members, and dissolve only the semantic relationship.
- Added temporary tinted membership overlays plus safe add/remove-member actions that update semantic registration without moving or deleting the underlying canvas elements.
- Changed semantic-unit reveal to a non-interactive fixed visual overlay so linked file nodes are highlighted without activating their Markdown links, and clarified the add-member menu wording.
- Fixed managed 2D file-node activation at its source: canvas navigation now requires a real pointer hit on the drawing surface, ignores menu and toolbar clicks, and reserves ordinary Markdown opening for double-click so single-click remains available for selection.
- Scoped semantic membership overlays to their originating canvas view so they are destroyed immediately when that view closes or navigates away and can never remain over a Markdown page.
- Corrected semantic membership overlay alignment by rendering it in the Excalidraw container's local coordinate system instead of mixing viewport-fixed and transformed ancestor coordinates.
- Added explicit cross-canvas insertion for synchronized instances and unrelated copies, including canonical member remapping, internal bindings, relative layout, embedded image assets, target-canvas backups, and source-hash validation.
- Added revision-based synchronized-instance propagation: edits update other open canvases immediately, closed canvases apply pending revisions when opened, whole-instance movement remains local, and every target write is backed up and hash-checked.
- Repaired Markdown-save text ID rewrites for imported instances, switched new live member IDs to the stable eight-character form used by Excalidraw Markdown blocks, and automatically dissolved registrations when an entire visual instance is deleted.
- Replaced manual Markdown path entry with a hierarchical folder picker that lists only ordinary Markdown documents and excludes canvas files.
- Captured semantic-unit selections and binary assets before opening the creation dialog so images and file nodes remain available even if the originating canvas view is detached.
- Made the Markdown document metadata panel directly editable by allowing its native controls to own pointer and keyboard events.
- Hid the underlying `knowledge-suite-fields` fenced block in Live Preview while preserving the source data in the Markdown file.
- Redesigned the metadata manager with a cleaner title bar, compact toolbar, native-style folder menu, simplified document count, and consistent Obsidian typography and spacing.
- Restyled the New field action with a softer purple surface, white label and icon, and coordinated hover, active, and focus states.
- Fixed Ctrl, Alt, Tab, and other keys opening an empty Obsidian tab from the metadata manager by replacing read-only `getLeaf(false)` calls in the Knowledge Map Excalidraw integration with the non-creating `getMostRecentLeaf()` API.
- Removed the temporary keyboard interception, focus workaround, and diagnostic instrumentation used while isolating the empty-tab regression.

## 1.1.2 - 2026-08-27

- Added independently configurable commands for inserting standalone and inline LaTeX formulas in 2D canvases.
- Reused the shared local formula editor for standalone formula creation and editing, with an empty initial value and automatic input focus.
- Preserved standalone formula sizing when editing existing formulas.
- Replaced the Excalidraw Extras dependency in normal formula creation, editing, save, and reload flows with the bundled local SVG renderer.
- Fixed the Excalidraw Extras installation prompt appearing after saving a canvas containing locally created formulas.

## 1.1.1 - 2026-08-26

- Added marquee selection to the 3D canvas while keeping direct node clicks focused on opening their targets.
- Added Backspace/Delete removal for selected 3D nodes and a confirmed “remove from this canvas” context-menu action that never deletes source files.
- Changed globe rotation to Space + left drag and simplified the in-canvas interaction hint.
- Removed redundant 3D canvas title, back button, and child-canvas button from the plugin view.
- Deepened the space background and added a textured 3D Moon plus smaller, widely distributed planetary scenery.
- Added offline planetary textures with third-party source notices.

## 1.1.0 - 2026-08-26

- Added independent persistent 2D and 3D canvases with explicit parent-child relationships and reliable Back navigation.
- Added a nestable Canvas tree with reference directions, context menus, and persisted drag sorting.
- Redesigned managed-node context menus for canvases, folders, files, and ordinary Excalidraw elements.
- Added persistent colors, shapes, custom palettes, Lucide icons, and Emoji icons to managed 2D and 3D nodes.
- Persisted Lucide SVG assets across canvas reloads and automatically rebuilt previously missing managed-node icons.
- Refined 2D managed nodes with unified sizing, internal layouts, fine strokes, compact generated canvas names, consistent folder icons, and dynamically sized text-first file nodes that retain complete names.
- Refined 3D canvases with a star field, readable resizable nodes, direct context menus, and four-edge resizing.
- Added a polished 2D/3D chooser when a folder in a 3D canvas needs a child canvas.
- Fixed inline formulas hiding, spacing, misaligning, or blocking selection of following text.
- Improved compact Chinese menu labels and visual-layer controls, including overlap-aware forward/backward movement.
- Acceptance status: all staged user acceptance checks passed before release-candidate packaging.

## 1.0.0 - 2026-08-23

- First tested release of Obsidian Knowledge Suite.
- Consolidates Knowledge Map, Excalidraw Custom, and Excalidraw Core Custom into one maintained source repository.
- Adds unified verification, testing, production build, packaging, and test-Vault deployment commands.
- Produces one combined installation ZIP and two standard Obsidian plugin artifact directories.
- Includes editable inline formulas, formula-only text, partial bold formatting with Ctrl+B, and persistence after editing.
- Includes folder drill-down, file and folder nodes, saved node positions, curved relationship edges, and layout reset.
- Preserves existing Excalidraw drawings, images, settings, and Knowledge Map user data during deployment.
- Acceptance status: source verification passed; Core tests 4/4; Knowledge Map tests 25/25; independent production build and test-Vault deployment passed after all three legacy repositories were renamed.
