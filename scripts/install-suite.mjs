import { commands, paths, run, validateNodeVersion } from "./lib/suite.mjs";

validateNodeVersion();

if (!process.argv.includes("--confirm")) {
  console.error(
    [
      "Dependency installation may download packages from the internet.",
      "Nothing was installed.",
      "Run the following command only after approving downloads:",
      "  npm run install:suite -- --confirm",
    ].join("\n"),
  );
  process.exit(2);
}

run(commands.corepack, ["yarn", "install", "--frozen-lockfile"], {
  cwd: paths.core,
});
run(commands.npm, ["ci"], { cwd: paths.excalidrawPlugin });
run(commands.npm, ["ci"], { cwd: paths.knowledgeMap });

console.log("\nAll suite dependencies are installed.");
