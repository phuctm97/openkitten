import type { Context } from "grammy";
import { logger } from "~/lib/logger";
import type { Scope } from "~/lib/scope";

export function grammyCreateHandler<C extends Context>(
  scope: Scope,
  fn: (scope: Scope, ctx: C) => Promise<void>,
): (ctx: C) => void {
  return (ctx) => {
    scope.floatingPromises.track(
      fn(scope, ctx).catch((error) => {
        logger.fatal("Failed to process update from Telegram", error, {
          update: ctx.update,
        });
        scope.shutdown.trigger();
      }),
    );
  };
}
