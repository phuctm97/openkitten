import type { Context, NextFunction } from "grammy";
import { logger } from "~/lib/logger";

export function grammyFilterChat(config: {
  userId: number;
  groupChat: boolean;
}): (ctx: Context, next: NextFunction) => Promise<void> | undefined {
  return (ctx, next) => {
    const chatType = ctx.chat?.type;

    if (!config.groupChat) {
      if (ctx.from?.id !== config.userId) {
        logger.warn("grammY rejected an unauthorized update", {
          update: ctx.update,
        });
        return;
      }
      return next();
    }

    // Group chat enabled
    if (chatType === "private") {
      if (ctx.from?.id !== config.userId) {
        logger.warn("grammY rejected an unauthorized private update", {
          update: ctx.update,
        });
        return;
      }
      return next();
    }

    if (chatType === "group" || chatType === "supergroup") {
      return next();
    }

    logger.warn("grammY rejected an update from unsupported chat type", {
      update: ctx.update,
    });
    return;
  };
}
