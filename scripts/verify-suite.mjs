import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureFile,
  getSuiteVersion,
  paths,
  readJson,
  sha256,
  validateNodeVersion,
} from "./lib/suite.mjs";

validateNodeVersion();

const suite = getSuiteVersion();
const corePackage = readJson(join(paths.corePackage, "package.json"));
const excalidrawManifest = readJson(join(paths.excalidrawPlugin, "manifest.json"));
const pluginConstants = readFileSync(
  join(paths.excalidrawPlugin, "src", "constants", "constants.ts"),
  "utf8",
);
const coreObsidianUtils = readFileSync(
  join(paths.core, "packages", "common", "src", "commonObsidianUtils.ts"),
  "utf8",
);

const assertions = [
  [corePackage.version === suite.components.excalidrawCore.version, "Core version matches suite-version.json"],
  [excalidrawManifest.id === "knowledge-suite", "Unified plugin manifest uses the knowledge-suite ID"],
  [excalidrawManifest.name === "Knowledge Suite", "Unified plugin manifest uses the Knowledge Suite name"],
  [excalidrawManifest.version === suite.suiteVersion, "Unified plugin manifest version matches suite-version.json"],
  [pluginConstants.includes('PLUGIN_ID = "knowledge-suite"'), "Runtime plugin ID uses knowledge-suite"],
  [coreObsidianUtils.includes('HOST_PLUGIN_ID = "knowledge-suite"'), "Excalidraw Core host plugin ID uses knowledge-suite"],
  [existsSync(join(paths.core, "LICENSE")), "Excalidraw Core license is present"],
  [existsSync(join(paths.excalidrawPlugin, "LICENSE")), "Excalidraw plugin license is present"],
  [existsSync(join(paths.excalidrawPlugin, "third-party", "knowledge-map", "LICENSE")), "Knowledge Map license is present"],
  [existsSync(join(paths.excalidrawPlugin, "src", "features", "knowledge-map", "KnowledgeMapController.ts")), "Knowledge Map controller is integrated"],
  [existsSync(join(paths.core, "packages", "element", "src", "inlineTextStyle.ts")), "Partial-bold source is present"],
  [existsSync(join(paths.core, "packages", "excalidraw", "actions", "actionInlineBold.tsx")), "Partial-bold action is present"],
];

const agplLicense = readFileSync(join(paths.excalidrawPlugin, "LICENSE"), "utf8");
assertions.push([
  agplLicense.includes("GNU AFFERO GENERAL PUBLIC LICENSE"),
  "Knowledge Suite distribution license is AGPL-3.0",
]);

let failed = false;
for (const [passed, label] of assertions) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  failed ||= !passed;
}

const builtCore = join(paths.corePackage, "dist", "excalidraw.production.min.js");
if (existsSync(builtCore)) {
  const source = readFileSync(builtCore, "utf8");
  const signatures = ["obsidianInlineTextStyles", "excalidraw-toggle-inline-bold"];
  for (const signature of signatures) {
    const passed = source.includes(signature);
    console.log(`${passed ? "PASS" : "FAIL"}  Core bundle contains ${signature}`);
    failed ||= !passed;
  }
  console.log(`INFO  Core production SHA-256: ${sha256(builtCore)}`);
} else {
  console.log("INFO  Core bundle has not been built yet.");
}

if (failed) {
  process.exit(1);
}

ensureFile(join(paths.suiteRoot, "BASELINES.md"));
console.log("\nSuite source verification passed.");

