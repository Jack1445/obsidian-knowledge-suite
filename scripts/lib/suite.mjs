import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const suiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const paths = Object.freeze({
  suiteRoot,
  core: join(suiteRoot, "packages", "excalidraw-core-custom"),
  corePackage: join(
    suiteRoot,
    "packages",
    "excalidraw-core-custom",
    "packages",
    "excalidraw",
  ),
  excalidrawPlugin: join(suiteRoot, "plugins", "excalidraw-custom"),
  knowledgeMap: join(suiteRoot, "plugins", "knowledge-map"),
  release: join(suiteRoot, "release"),
  staging: join(suiteRoot, "release", "staging"),
  artifacts: join(suiteRoot, "release", "artifacts"),
});

export const commands = Object.freeze({
  npm: process.platform === "win32" ? "npm.cmd" : "npm",
  corepack: process.platform === "win32" ? "corepack.cmd" : "corepack",
});

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export const writeJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const ensureFile = (file, label = file) => {
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`Missing ${label}: ${file}`);
  }
  return file;
};

export const ensureDirectory = (directory, label = directory) => {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`Missing ${label}: ${directory}`);
  }
  return directory;
};

export const ensureDependencies = () => {
  const checks = [
    [join(paths.core, "node_modules"), "Excalidraw Core dependencies"],
    [join(paths.excalidrawPlugin, "node_modules"), "Excalidraw plugin dependencies"],
    [join(paths.knowledgeMap, "node_modules"), "Knowledge Map dependencies"],
  ];
  const missing = checks.filter(([directory]) => !existsSync(directory));
  if (missing.length) {
    const list = missing.map(([, label]) => `- ${label}`).join("\n");
    throw new Error(
      `Dependencies are not installed:\n${list}\nRun \"npm run install:suite -- --confirm\" when downloads are allowed.`,
    );
  }
};

export const run = (command, args, options = {}) => {
  const cwd = options.cwd ?? suiteRoot;
  console.log(`\n> ${command} ${args.join(" ")}\n  cwd: ${cwd}`);
  const isWindowsCommandScript =
    process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  const quoteWindowsArgument = (value) => {
    const text = String(value);
    if (/[\r\n&|<>^%]/.test(text)) {
      throw new Error(`Unsafe Windows command argument: ${text}`);
    }
    return /[\s"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const executable = isWindowsCommandScript
    ? process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe"
    : command;
  const executableArgs = isWindowsCommandScript
    ? [
        "/d",
        "/s",
        "/c",
        [command, ...args].map(quoteWindowsArgument).join(" "),
      ]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
};

const normalizedWithSeparator = (value) => `${resolve(value)}${sep}`.toLowerCase();

export const assertPathWithin = (candidate, parent) => {
  const resolvedCandidate = resolve(candidate);
  const normalizedParent = normalizedWithSeparator(parent);
  if (
    resolvedCandidate.toLowerCase() !== resolve(parent).toLowerCase() &&
    !`${resolvedCandidate}${sep}`.toLowerCase().startsWith(normalizedParent)
  ) {
    throw new Error(`Refusing to modify path outside ${parent}: ${candidate}`);
  }
  return resolvedCandidate;
};

export const resetDirectoryWithin = (directory, parent) => {
  const safeDirectory = assertPathWithin(directory, parent);
  if (safeDirectory.toLowerCase() === resolve(parent).toLowerCase()) {
    throw new Error(`Refusing to reset the parent directory itself: ${parent}`);
  }
  if (existsSync(safeDirectory)) {
    rmSync(safeDirectory, { recursive: true, force: true });
  }
  mkdirSync(safeDirectory, { recursive: true });
};

export const copyFileEnsured = (source, destination) => {
  ensureFile(source);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
};

export const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

export const listFiles = (root) => {
  if (!existsSync(root)) {
    return [];
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  };
  visit(root);
  return files.sort((a, b) => a.localeCompare(b));
};

export const relativePosix = (root, file) => relative(root, file).split(sep).join("/");

export const getSuiteVersion = () => readJson(join(suiteRoot, "suite-version.json"));

export const validateNodeVersion = () => {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(major) || major < 22) {
    throw new Error(`Node.js 22 or newer is required. Current version: ${process.version}`);
  }
};

export const validateAbsoluteVaultPath = (value) => {
  if (!value || !isAbsolute(value)) {
    throw new Error("Provide an absolute Vault path using --vault <path>.");
  }
  const vault = resolve(value);
  ensureDirectory(vault, "Vault directory");
  ensureDirectory(join(vault, ".obsidian"), "Vault .obsidian directory");
  return vault;
};
