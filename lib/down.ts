import { defineCommand } from "citty";
import { logger } from "~/lib/logger";

export const down = defineCommand({
  meta: { description: "Stop and remove OpenKitten from system services." },
  run: async () => {
    logger.silly("down");
  },
});
