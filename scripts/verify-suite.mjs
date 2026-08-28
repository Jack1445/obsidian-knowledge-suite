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
const knowledgeManifest = readJson(join(paths.knowledgeMap, "manifest.json"));

const assertions = [
  [corePackage.version === suite.components.excalidrawCore.version, "Core version matches suite-version.json"],
  [excalidrawManifest.version === suite.components.excalidrawPlugin.version, "Excalidraw manifest version matches suite-version.json"],
  [knowledgeManifest.version === suite.components.knowledgeMap.version, "Knowledge Map manifest version matches suite-version.json"],
  [existsSync(join(paths.core, "LICENSE")), "Excalidraw Core license is present"],
  [existsSync(join(paths.excalidrawPlugin, "LICENSE")), "Excalidraw plugin license is present"],
  [existsSync(join(paths.knowledgeMap, "LICENSE")), "Knowledge Map license is present"],
  [existsSync(join(paths.core, "packages", "element", "src", "inlineTextStyle.ts")), "Partial-bold source is present"],
  [existsSync(join(paths.core, "packages", "excalidraw", "actions", "actionInlineBold.tsx")), "Partial-bold action is present"],
];

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

