# Knowledge Suite settings surface

Knowledge Suite registers one deliberately minimal Obsidian settings tab so the
standard plugin **Settings** entry remains available. It currently contains no
general-purpose switches. The only global controls are optional defaults for
newly created managed canvases; every other adjustable feature has a clearer
contextual home.

## Product rule

- Put controls beside the canvas, document, field, or semantic unit they affect.
- Keep safety guarantees such as backups, schema validation, and legacy-data import mandatory rather than configurable.
- Do not expose inherited Excalidraw integrations merely because their historical settings UI exists.
- Add a global setting only when it affects multiple surfaces and cannot be understood or previewed in context.

## Current global page

- Shows the installed Knowledge Suite version.
- Provides one collapsed global section for optional default 2D/3D managed-canvas names and storage folders. Blank values preserve the historical creation behavior.
- Explains where contextual controls live.
- Makes the always-on data-protection policy explicit.
- Persists only the four optional canvas-creation defaults and does not expose inherited Excalidraw options.

## Current contextual controls

- Knowledge Map node size and link thickness live in the map toolbar.
- Markdown fields and filters live in Knowledge Management and the semantic filter canvas.
- Semantic-unit relationships and locks live in canvas and management context menus.
- Zoom and temporary layout controls live on their respective two-dimensional canvases.

The inherited settings data model remains available for file compatibility and safe defaults, but its legacy settings tab is not shipped in the active interface.
