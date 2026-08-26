# Changelog

## 1.1.0 - 2026-08-26

- Added independent persistent 2D and 3D canvases with explicit parent-child relationships and reliable Back navigation.
- Added a nestable Canvas tree with reference directions, context menus, and persisted drag sorting.
- Redesigned managed-node context menus for canvases, folders, files, and ordinary Excalidraw elements.
- Added persistent colors, shapes, custom palettes, Lucide icons, and Emoji icons to managed 2D and 3D nodes.
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
