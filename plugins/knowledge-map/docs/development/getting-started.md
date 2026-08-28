# Contributor getting started

## 1. Install dependencies

```bash
npm install
```

## 2. Start the watcher

```bash
npm run dev
```

The watcher compiles `src/main.ts` and its imports into `main.js` at the repository root.

## 3. Load it in a test vault

Use a separate vault, not your primary notes. Put this project at:

```text
<test-vault>/.obsidian/plugins/knowledge-map/
```

Enable the plugin and run **Reload app without saving** after source changes. Changes to `manifest.json` require a full Obsidian restart.

On Windows, deploy the built plugin with the guarded script:

```powershell
.\scripts\deploy-test-vault.ps1 -TargetDirectory '<vault>\.obsidian\plugins\knowledge-map'
```

It refuses any target directory not named `knowledge-map`, and refuses to overwrite a manifest belonging to another plugin.

## 4. Know where to make a change

- File/folder inclusion rule: `src/obsidian/vault-graph-builder.ts`
- Initial coordinates: `src/services/initial-layout.ts`
- Clicking and navigation: `src/views/knowledge-map-view.ts`
- SVG interaction: `src/views/graph-renderer.ts`
- Saved settings/layout: `src/data/store.ts`
- Appearance: `styles.css`

Before submitting a change, run `npm run check`.
