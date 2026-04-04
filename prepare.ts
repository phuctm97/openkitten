import { dirname } from "node:path";

await Bun.$`bun --bun lefthook install --force`.quiet();

const reactRouterConfigFiles = new Bun.Glob(
  "packages/*/react-router.config.ts",
);
const reactRouteTypegenPromises: Promise<unknown>[] = [];

for await (const reactRouterConfigFile of reactRouterConfigFiles.scan(".")) {
  reactRouteTypegenPromises.push(
    Bun.$`bun --bun react-router typegen`
      .cwd(dirname(reactRouterConfigFile))
      .quiet(),
  );
}

await Promise.all(reactRouteTypegenPromises);
