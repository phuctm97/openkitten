import { dirname } from "node:path";

await Bun.$`bun --bun lefthook install --force`.quiet();

const reactRouterConfigFiles = new Bun.Glob(
  "packages/*/react-router.config.ts",
);
const nextConfigFiles = new Bun.Glob("packages/*/next.config.ts");
const promises: Promise<unknown>[] = [];

for await (const reactRouterConfigFile of reactRouterConfigFiles.scan(".")) {
  promises.push(
    Bun.$`bun --bun react-router typegen`
      .cwd(dirname(reactRouterConfigFile))
      .quiet(),
  );
}

for await (const nextConfigFile of nextConfigFiles.scan(".")) {
  promises.push(
    Bun.$`bun --bun next typegen`.cwd(dirname(nextConfigFile)).quiet(),
  );
}

await Promise.all(promises);
