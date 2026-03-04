import { defineCommand, runMain } from "citty";
import serve from "~/lib/serve";
import up from "~/lib/up";
import pkg from "~/package.json";

const main = defineCommand({
	meta: {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
	},
	subCommands: {
		up,
		serve,
	},
});

runMain(main);
