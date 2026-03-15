import { consola } from "consola";
import type { Context, NextFunction } from "grammy";

export function grammyFilterUser(
  userId: number,
): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    if (ctx.from?.id !== userId) {
      consola.fail("grammY rejected an unauthorized update", {
        userId: ctx.from?.id,
        updateId: ctx.update.update_id,
      });
      return;
    }
    return next();
  };
}
