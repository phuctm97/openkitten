import { defineCommand } from "citty";
import { logger } from "~/lib/logger";

export const up = defineCommand({
  meta: { description: "Install and update OpenKitten as a system service." },
  run: async () => {
    logger.silly("up");
  },
});
