# Product overview

## The problem

Obsidian's core Graph view shows notes and links, but it does not show folders as nodes and it does not serve as a folder-by-folder navigation system. Its force layout may also change when the graph is rebuilt.

Knowledge Map adds a persistent spatial layer to the vault:

1. Open the map at the vault root.
2. See direct child folders and Markdown notes.
3. Click a folder to enter its map, where the folder sits above its direct children.
4. Click a note to open it.
5. Drag nodes into meaningful positions; those coordinates are restored later.

The root map intentionally has no visible `Vault` node. The vault root is navigation context; its direct folders and notes are the map content.

Inside a folder map, a containment edge connects the current-folder node to every direct child folder and note. These hierarchy edges come from the real Vault folder structure. Obsidian note links remain separate link edges.

## Source of truth

The vault remains the source of truth. Knowledge Map does not create duplicate note or folder records. It derives each map from Obsidian's `Vault` and `MetadataCache` APIs, then stores only presentation state such as coordinates, zoom, and filters.

## Relationship rules

- Folder containment is an actual hierarchy and powers drill-down.
- A note link is directional, but it is not assumed to be a parent-child relationship.
- Future semantic hierarchy must be explicitly declared by the user, for example through frontmatter or a custom relation type.
