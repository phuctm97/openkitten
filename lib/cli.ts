import { defineCommand } from "citty";
import { consola, LogLevels } from "consola";
import { down } from "~/lib/down";
import { serve } from "~/lib/serve";
import { up } from "~/lib/up";
import pkg from "~/package.json" with { type: "json" };

export const cli = defineCommand({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  args: {
    verbose: {
      type: "boolean",
      description: "Show verbose logs.",
    },
  },
  setup({ args }) {
    if (args.verbose) consola.level = LogLevels.verbose;
  },
  cleanup() {
    consola.level = LogLevels.info;
  },
  subCommands: {
    serve,
    up,
    down,
  },
});
