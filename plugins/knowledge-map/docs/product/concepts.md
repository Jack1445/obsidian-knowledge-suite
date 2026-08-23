# Core concepts and interactions

## Folder map

A folder map is generated from one real vault folder. It contains the current folder node, direct child folders, direct Markdown notes, and optionally linked notes outside the folder.

## Node types

- **Current folder:** the hierarchy root shown above its direct children.
- **Folder:** drills into that folder.
- **Note:** opens the Markdown file.
- **External note:** a dimmed note linked from the current folder but stored elsewhere.

## Links

Two edge types are deliberately separate:

- **Containment:** generated from the real Vault folder structure; connects the current folder to every direct child.
- **Link:** generated from `MetadataCache.resolvedLinks`; represents a real internal note link and is not interpreted as hierarchy.

Containment edges render as solid warm-orange hierarchy curves. Note links render as dashed blue arcs. Both curves update immediately when a connected node is dragged.

Going up one level uses the toolbar navigation and breadcrumbs. The map does not add a synthetic `..` node.

## Persistent positions

Unmodified nodes use a deterministic hierarchy layout: the current folder is above, and folders then notes form a naturally sorted row below it. Dragging a node marks it fixed and saves its position after the gesture ends. Fixed positions override the automatic layout. Resetting a folder layout is the only normal action that intentionally discards those positions.

## Canvas types

- **Automatic folder map:** live graph generated from the vault. Node size and link thickness can be adjusted in its toolbar.
- **Blank canvas:** a native Excalidraw drawing. It requires the separate Excalidraw plugin and supports the full original drawing interface.
- **Map canvas:** a native Excalidraw drawing pre-populated from the visible automatic folder map.
- **Globe canvas:** an interactive Three.js globe using the same current-folder graph and separately saved latitude/longitude.

The 2D map toolbar has visible **Globe** and **Canvases** buttons. Matching ribbon icons and command-palette commands provide global access.
