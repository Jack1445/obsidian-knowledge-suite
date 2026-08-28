import {
  commands,
  ensureDependencies,
  paths,
  run,
  validateNodeVersion,
} from "./lib/suite.mjs";

validateNodeVersion();
ensureDependencies();

run(
  commands.corepack,
  ["yarn", "vitest", "run", "packages/element/tests/inlineTextStyle.test.ts"],
  { cwd: paths.core },
);
console.log(
  "\nExcalidraw Custom is validated by its production build in build:suite; " +
    "the imported upstream full-repository ESLint baseline currently contains known errors.",
);
run(commands.npm, ["run", "typecheck"], { cwd: paths.knowledgeMap });
run(commands.npm, ["run", "lint"], { cwd: paths.knowledgeMap });
run(commands.npm, ["test"], { cwd: paths.knowledgeMap });

console.log("\nAll suite checks passed.");
