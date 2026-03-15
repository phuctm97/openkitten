import type { Context, NextFunction } from "grammy";

export function grammyFilterUser(
  userId: number,
): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    if (ctx.from?.id !== userId) return;
    return next();
  };
}
