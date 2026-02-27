import { defineCommand } from "citty";
import { down } from "~/lib/down";
import { logger } from "~/lib/logger";
import { resetLoggerSettings } from "~/lib/reset-logger-settings";
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
    if (args.verbose) {
      logger.settings.minLevel = 0; // silly
    } else {
      resetLoggerSettings();
    }
  },
  cleanup() {
    resetLoggerSettings();
  },
  subCommands: {
    serve,
    up,
    down,
  },
});
