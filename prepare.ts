import { dirname } from "node:path";

await Bun.$`bun --bun lefthook install --force`.quiet();

const reactRouterConfigGlobs = [
  new Bun.Glob("packages/*/react-router.config.ts"),
  new Bun.Glob("packages/*/*/react-router.config.ts"),
  new Bun.Glob("packages/*/*/*/react-router.config.ts"),
];
const nextConfigGlobs = [
  new Bun.Glob("packages/*/next.config.ts"),
  new Bun.Glob("packages/*/*/next.config.ts"),
  new Bun.Glob("packages/*/*/*/next.config.ts"),
];
const fumadocsConfigGlobs = [
  new Bun.Glob("packages/*/source.config.ts"),
  new Bun.Glob("packages/*/*/source.config.ts"),
  new Bun.Glob("packages/*/*/*/source.config.ts"),
];
const promises: Promise<unknown>[] = [];

for (const glob of reactRouterConfigGlobs) {
  for await (const reactRouterConfigFile of glob.scan(".")) {
    const dir = dirname(reactRouterConfigFile);
    promises.push(Bun.$`bun --bun react-router typegen`.cwd(dir).quiet());
  }
}

for (const glob of nextConfigGlobs) {
  for await (const nextConfigFile of glob.scan(".")) {
    const dir = dirname(nextConfigFile);
    promises.push(Bun.$`bun --bun next typegen`.cwd(dir).quiet());
  }
}

for (const glob of fumadocsConfigGlobs) {
  for await (const fumadocsConfigFile of glob.scan(".")) {
    const dir = dirname(fumadocsConfigFile);
    promises.push(Bun.$`bun --bun fumadocs-mdx`.cwd(dir).quiet());
  }
}

await Promise.all(promises);
