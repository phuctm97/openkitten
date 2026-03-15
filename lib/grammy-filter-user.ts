import { consola } from "consola";
import type { Context, NextFunction } from "grammy";

export function grammyFilterUser(
  userId: number,
): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    if (ctx.from?.id !== userId) {
      consola.warn("grammY received an update from unauthorized user", {
        userId: ctx.from?.id,
        updateId: ctx.update.update_id,
      });
      return;
    }
    return next();
  };
}
