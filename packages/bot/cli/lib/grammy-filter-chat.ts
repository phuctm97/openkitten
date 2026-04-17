import type { Context, NextFunction } from "grammy";
import { logger } from "~/lib/logger";

export function grammyFilterChat(config: {
  userId: number;
}): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    if (ctx.chat?.type !== "private" || ctx.from?.id !== config.userId) {
      logger.warn("grammY rejected an unauthorized update", {
        update: ctx.update,
      });
      return;
    }
    return next();
  };
}
