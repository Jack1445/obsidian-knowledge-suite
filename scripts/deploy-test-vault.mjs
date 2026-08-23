import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  copyFileEnsured,
  ensureFile,
  paths,
  validateAbsoluteVaultPath,
  validateNodeVersion,
} from "./lib/suite.mjs";

validateNodeVersion();

const getArgument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const vault = validateAbsoluteVaultPath(
  getArgument("--vault") ?? process.env.OBSIDIAN_TEST_VAULT,
);
const dryRun = process.argv.includes("--dry-run");
const pluginsRoot = join(vault, ".obsidian", "plugins");
const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const backupRoot = join(pluginsRoot, ".knowledge-suite-backups", timestamp);

const deployments = [
  {
    id: "obsidian-excalidraw-plugin",
    source: join(paths.staging, ".obsidian", "plugins", "obsidian-excalidraw-plugin"),
  },
  {
    id: "knowledge-map",
    source: join(paths.staging, ".obsidian", "plugins", "knowledge-map"),
  },
];

for (const deployment of deployments) {
  const target = join(pluginsRoot, deployment.id);
  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    const sourceFile = ensureFile(join(deployment.source, file));
    const targetFile = join(target, file);
    console.log(`${dryRun ? "Would deploy" : "Deploying"}: ${targetFile}`);
    if (dryRun) {
      continue;
    }
    if (existsSync(targetFile)) {
      const backupFile = join(backupRoot, deployment.id, file);
      copyFileEnsured(targetFile, backupFile);
    }
    mkdirSync(target, { recursive: true });
    copyFileEnsured(sourceFile, targetFile);
  }
}

if (dryRun) {
  console.log("\nDry run complete. No Vault files were changed.");
} else {
  console.log(`\nDeployment complete. Previous plugin files were backed up to:\n${backupRoot}`);
  console.log("User data files were not modified.");
}

