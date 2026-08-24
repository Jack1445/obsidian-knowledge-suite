# Testing

## Automated checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run all of them with `npm run check`.

## Manual Obsidian checklist

Use a disposable test vault containing nested folders, linked notes, an unlinked note, and a cross-folder link.

- Open the map from the ribbon and command palette.
- Drill into a folder and confirm there is no synthetic `..` node, then use back, forward, and breadcrumbs.
- Confirm the current folder is above a naturally sorted row of direct children.
- Confirm a containment edge joins the current folder to every direct child.
- Confirm containment edges are solid warm-orange curves and note links are dashed blue arcs.
- Drag a connected node and confirm every attached curve follows it continuously.
- Open a note normally and with Ctrl/Cmd-click.
- Drag several nodes, close and reopen Obsidian, and confirm their positions remain.
- Pan and zoom a map, reopen it, and confirm its viewport remains.
- Create, rename, move, and delete a file and folder while the map is open.
- Add and remove an internal link and confirm the edge updates.
- Toggle external links and labels in settings.
- Test both light and dark themes.
- Reset a folder layout and confirm only that folder is affected.
- Confirm the root map has no visible Vault node.
- Adjust node size and link thickness from the map toolbar.
- With Excalidraw enabled, create a Knowledge canvas and confirm the current folder map appears by default.
- Directly click a folder circle or its label and confirm the same canvas shows that folder's children; drag a node and confirm dragging does not accidentally navigate.
- Move several generated nodes, drill into another folder and return, then refresh and reopen the canvas; confirm each folder restores its own layout.
- Repeatedly drag both endpoints of containment and note-reference connections; confirm the two-point bound lines remain attached without folds or loops.
- Click **Reset layout** and confirm generated nodes return to their orderly default positions while manual nodes, text, and shapes remain.
- Add ordinary Excalidraw text and shapes, drill into another folder, and confirm the added elements remain.
- Select standalone text, confirm **B** appears in the existing font row, then toggle it with both the button and Ctrl/Cmd+B. Move, edit, recolor, reopen, and export the text; confirm the bold companion remains aligned and ordinary Excalidraw canvases do not show the control.
- Insert a formula from the three-dot menu and with Ctrl/Cmd+Shift+M. Check all five symbol palettes, preview, Ctrl/Cmd+Enter, Escape, outside-click confirmation, persistence, movement, resizing, double-click editing, and edit-in-place position preservation.
- Drag a Markdown file and a folder from the file explorer onto the knowledge canvas; confirm both become editable nodes and the folder creates or reopens one child Knowledge Canvas without changing the source drawing.
- Confirm child canvases show Back without Root, and Back focuses or reopens the exact parent drawing.
- Open **Canvas tree**, expand at least three parent/child levels, and confirm clicking a name opens and highlights the correct canvas without moving its file.
- Follow a note node link and confirm the real Markdown file opens.
- Run the refresh command and confirm only the generated current-folder layer is rebuilt.
- Create a plain Excalidraw canvas and confirm it has no automatic knowledge nodes.
- Open the globe, rotate and zoom it, click nodes, drag a node to a new geographic position, and reopen it.
- Open the map, globe, and canvas manager from both their ribbon icons and command-palette entries.
