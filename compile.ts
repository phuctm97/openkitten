import { rm } from "node:fs/promises";
import { join } from "node:path";
import pkg from "./package.json" with { type: "json" };

await rm(join(import.meta.dir, "dist"), { recursive: true, force: true });

await Bun.build({
	entrypoints: [join(import.meta.dir, pkg.main)],
	compile: { outfile: join(import.meta.dir, "dist", pkg.name) },
	minify: true,
	bytecode: true,
	target: "bun",
});
