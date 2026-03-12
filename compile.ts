import { rm } from "node:fs/promises";
import { join } from "node:path";
import pkg from "~/package.json" with { type: "json" };

await rm(join(import.meta.dirname, "dist"), { recursive: true, force: true });

await Bun.build({
  entrypoints: [join(import.meta.dirname, pkg.main)],
  compile: { outfile: join(import.meta.dirname, "dist", pkg.name) },
  minify: true,
  splitting: true,
});
