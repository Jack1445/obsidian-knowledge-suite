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
run(commands.npm, ["run", "test:knowledge-map"], {
  cwd: paths.excalidrawPlugin,
});

console.log("\nAll suite checks passed.");
