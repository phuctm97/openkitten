import { dirname } from "node:path";

await Bun.$`bun --bun lefthook install --force`.quiet();

const reactRouterConfigFiles = new Bun.Glob(
  "packages/*/react-router.config.ts",
);
const nextConfigFiles = new Bun.Glob("packages/*/next.config.ts");
const fumadocsConfigFiles = new Bun.Glob("packages/*/source.config.ts");
const promises: Promise<unknown>[] = [];

for await (const reactRouterConfigFile of reactRouterConfigFiles.scan(".")) {
  const dir = dirname(reactRouterConfigFile);
  promises.push(Bun.$`bun --bun react-router typegen`.cwd(dir).quiet());
}

for await (const nextConfigFile of nextConfigFiles.scan(".")) {
  const dir = dirname(nextConfigFile);
  promises.push(Bun.$`bun --bun next typegen`.cwd(dir).quiet());
}

for await (const fumadocsConfigFile of fumadocsConfigFiles.scan(".")) {
  const dir = dirname(fumadocsConfigFile);
  promises.push(Bun.$`bun --bun fumadocs-mdx`.cwd(dir).quiet());
}

await Promise.all(promises);
