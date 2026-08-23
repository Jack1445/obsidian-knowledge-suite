import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import {
  commands,
  copyFileEnsured,
  ensureDependencies,
  ensureFile,
  getSuiteVersion,
  listFiles,
  paths,
  relativePosix,
  resetDirectoryWithin,
  run,
  sha256,
  validateNodeVersion,
  writeJson,
} from "./lib/suite.mjs";

validateNodeVersion();
ensureDependencies();

run(
  commands.corepack,
  ["yarn", "--cwd", "packages/excalidraw", "build:umd"],
  { cwd: paths.core },
);

const coreDist = join(paths.corePackage, "dist");
const pluginCoreDist = join(
  paths.excalidrawPlugin,
  "node_modules",
  "@zsviczian",
  "excalidraw",
  "dist",
);
const coreArtifacts = [
  "excalidraw.production.min.js",
  "excalidraw.development.js",
  "styles.production.css",
  "styles.development.css",
];

for (const artifact of coreArtifacts) {
  const source = ensureFile(join(coreDist, artifact), `Core artifact ${artifact}`);
  const destination = join(pluginCoreDist, artifact);
  copyFileEnsured(source, destination);
  if (sha256(source) !== sha256(destination)) {
    throw new Error(`Core injection hash mismatch: ${artifact}`);
  }
  console.log(`Injected Core artifact: ${artifact}`);
}

run(commands.npm, ["run", "build"], { cwd: paths.excalidrawPlugin });
run(commands.npm, ["run", "build"], { cwd: paths.knowledgeMap });

const excalidrawDist = join(paths.excalidrawPlugin, "dist");
const excalidrawOutput = join(
  paths.staging,
  ".obsidian",
  "plugins",
  "obsidian-excalidraw-plugin",
);
const knowledgeOutput = join(
  paths.staging,
  ".obsidian",
  "plugins",
  "knowledge-map",
);

resetDirectoryWithin(paths.staging, paths.release);

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileEnsured(join(excalidrawDist, file), join(excalidrawOutput, file));
}
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileEnsured(join(paths.knowledgeMap, file), join(knowledgeOutput, file));
}

const installGuide = join(paths.suiteRoot, "docs", "INSTALL.md");
if (existsSync(installGuide)) {
  copyFileEnsured(installGuide, join(paths.staging, "INSTALL.md"));
}

const bundledPlugin = readFileSync(join(excalidrawOutput, "main.js"), "utf8");
const unpackMarker = "const unpackExcalidraw";
const markerPosition = bundledPlugin.indexOf(unpackMarker);
if (markerPosition < 0) {
  throw new Error("Could not locate the embedded Excalidraw Core payload.");
}
const callPosition = bundledPlugin.indexOf("unpackBase64Deflate(", markerPosition);
const quotePosition = bundledPlugin.indexOf('"', callPosition);
const quoteEnd = bundledPlugin.indexOf('"', quotePosition + 1);
if (callPosition < 0 || quotePosition < 0 || quoteEnd < 0) {
  throw new Error("Could not parse the embedded Excalidraw Core payload.");
}
const embeddedCore = inflateSync(
  Buffer.from(bundledPlugin.slice(quotePosition + 1, quoteEnd), "base64"),
).toString("utf8");
for (const signature of ["obsidianInlineTextStyles", "excalidraw-toggle-inline-bold"]) {
  if (!embeddedCore.includes(signature)) {
    throw new Error(`Built Excalidraw plugin is missing Core signature: ${signature}`);
  }
}

const suite = getSuiteVersion();
const stagedFiles = listFiles(paths.staging).map((file) => ({
  path: relativePosix(paths.staging, file),
  sha256: sha256(file),
}));
writeJson(join(paths.staging, "build-manifest.json"), {
  suiteVersion: suite.suiteVersion,
  builtAt: new Date().toISOString(),
  nodeVersion: process.version,
  components: suite.components,
  files: stagedFiles,
});

console.log(`\nSuite build complete: ${paths.staging}`);
