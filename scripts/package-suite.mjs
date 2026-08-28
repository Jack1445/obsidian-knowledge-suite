import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  copyFileEnsured,
  ensureFile,
  getSuiteVersion,
  listFiles,
  paths,
  relativePosix,
  resetDirectoryWithin,
  sha256,
  validateNodeVersion,
} from "./lib/suite.mjs";
import { createZipFromDirectory } from "./lib/zip.mjs";

validateNodeVersion();
ensureFile(join(paths.staging, "build-manifest.json"), "suite build manifest");

resetDirectoryWithin(paths.artifacts, paths.release);

const componentSources = [
  {
    source: join(paths.staging, ".obsidian", "plugins", "knowledge-suite"),
    destination: join(paths.artifacts, "knowledge-suite"),
  },
];
for (const component of componentSources) {
  for (const file of listFiles(component.source)) {
    const relativePath = relativePosix(component.source, file);
    copyFileEnsured(file, join(component.destination, relativePath));
  }
}

const licenses = [
  [join(paths.excalidrawPlugin, "LICENSE"), "AGPL-3.0.txt"],
  [join(paths.suiteRoot, "THIRD_PARTY_LICENSES.md"), "THIRD_PARTY_LICENSES.md"],
  [join(paths.core, "LICENSE"), "excalidraw-core-MIT.txt"],
  [
    join(paths.excalidrawPlugin, "third-party", "knowledge-map", "LICENSE"),
    "knowledge-map-MIT.txt",
  ],
];
for (const [source, filename] of licenses) {
  copyFileEnsured(
    source,
    join(paths.artifacts, "knowledge-suite", "licenses", filename),
  );
  copyFileEnsured(source, join(paths.staging, "licenses", filename));
}

const stagingChecksums = listFiles(paths.staging)
  .map((file) => `${sha256(file)}  ${relativePosix(paths.staging, file)}`)
  .join("\n");
writeFileSync(join(paths.staging, "SHA256SUMS.txt"), `${stagingChecksums}\n`, "utf8");

const suite = getSuiteVersion();
mkdirSync(paths.release, { recursive: true });
const zipFile = join(
  paths.release,
  `knowledge-suite-v${suite.suiteVersion}.zip`,
);
createZipFromDirectory(paths.staging, zipFile);

const releaseFiles = [zipFile, ...listFiles(paths.artifacts)];
const releaseChecksums = releaseFiles
  .map((file) => `${sha256(file)}  ${relativePosix(paths.release, file)}`)
  .join("\n");
writeFileSync(join(paths.release, "SHA256SUMS.txt"), `${releaseChecksums}\n`, "utf8");

console.log(`\nSuite package created: ${zipFile}`);
console.log(`Release SHA-256: ${sha256(zipFile)}`);

