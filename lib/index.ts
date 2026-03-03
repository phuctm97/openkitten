import { defineCommand, runMain } from "citty";
import selfUpdate from "~/lib/self-update";
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
		"self-update": selfUpdate,
	},
});

runMain(main);
