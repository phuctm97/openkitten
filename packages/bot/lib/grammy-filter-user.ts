import type { Context, NextFunction } from "grammy";
import { logger } from "~/lib/logger";

export function grammyFilterUser(
  userId: number,
): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    if (ctx.from?.id !== userId) {
      logger.warn("grammY rejected an unauthorized update", {
        update: ctx.update,
      });
      return;
    }
    return next();
  };
}
