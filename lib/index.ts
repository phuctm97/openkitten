import { defineCommand, runMain } from "citty";
import serve from "~/lib/serve";
import setup from "~/lib/setup";
import pkg from "~/package.json";

const main = defineCommand({
	meta: {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
	},
	subCommands: {
		setup,
		serve,
	},
});

runMain(main);
