# Knowledge Map

Knowledge Map turns an Obsidian vault into a navigable, persistent map.

Unlike Obsidian's core Graph view, folders are first-class nodes: open the vault map, click a folder to enter it, and click a Markdown note to open it. Notes in the same map are connected using their real Obsidian links. When you drag a node, Knowledge Map remembers its position.

> Status: early development (`0.1.0`). The plugin currently includes the folder-aware 2D map, Excalidraw canvas integration, and an interactive globe canvas.

## What it does

- Shows the current folder above one orderly row of its direct child folders and Markdown files.
- Draws containment edges from the current folder to every direct child.
- Lets you drill into folders and navigate with back, forward, and breadcrumbs.
- Opens note nodes in Obsidian, including Ctrl/Cmd-click in a new tab.
- Draws resolved internal links between visible notes.
- Optionally shows linked notes outside the current folder as dimmed external nodes.
- Saves node positions and the viewport separately for every folder map.
- Reacts to vault changes without requiring a manual rebuild.
- Uses Obsidian theme colors so the graph fits light, dark, and community themes.
- Creates live Knowledge canvases inside the installed Excalidraw plugin: the drawing starts with folder-aware nodes, supports folder drill-down, and keeps normal Excalidraw drawing tools available.

## Core concepts

| Concept | Meaning |
| --- | --- |
| Folder map | A graph generated from one real folder in the vault. |
| Folder node | A direct child folder. Clicking it drills down. |
| Note node | A Markdown file. Clicking it opens the note. |
| Containment edge | A hierarchy line from the current folder to one of its direct children. |
| Link edge | A resolved Obsidian link between two visible notes. It is not treated as a parent-child relation. |
| Saved layout | Node coordinates and viewport stored by this plugin. It never changes note contents. |

## Development

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

For convenient testing, place or link this repository at:

```text
<test-vault>/.obsidian/plugins/knowledge-map/
```

Then enable **Knowledge Map** under **Settings → Community plugins**.

Three ribbon icons provide direct access:

- **Open 2D knowledge map** (`network` icon)
- **Open knowledge globe** (`globe` icon)
- **Manage knowledge canvases** (`dashboard` icon)

The same actions are available from the command palette by searching for `Knowledge Map`.

Production checks:

```bash
npm run check
```

This runs type checking, linting, tests, and a production build.

## Project guide

- [Product overview](docs/product/overview.md)
- [Core concepts and interaction rules](docs/product/concepts.md)
- [Using the Excalidraw knowledge canvas](docs/product/knowledge-canvas.md)
- [Architecture and folder responsibilities](docs/architecture/overview.md)
- [Data and persistence](docs/architecture/data-model.md)
- [Excalidraw and globe integrations](docs/architecture/integrations.md)
- [Getting started as a contributor](docs/development/getting-started.md)
- [Testing and manual QA](docs/development/testing.md)
- [Roadmap](docs/product/roadmap.md)
- [Change log](CHANGELOG.md)

## Privacy and safety

Knowledge Map works locally. It does not upload vault data and does not modify note bodies or frontmatter. Removing a node from a saved layout never deletes the corresponding file. Layout data is stored through Obsidian's plugin data API.

## License

[MIT](LICENSE)
