const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

if (!existsSync(".git")) {
  console.log("Skipping nested Husky hook installation inside Knowledge Suite.");
  process.exit(0);
}

const command = process.platform === "win32" ? "husky.cmd" : "husky";
const result = spawnSync(command, ["install"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
