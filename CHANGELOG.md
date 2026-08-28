# Changelog

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
