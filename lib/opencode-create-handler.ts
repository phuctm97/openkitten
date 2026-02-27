import type { Event } from "@opencode-ai/sdk/v2";
import { logger } from "~/lib/logger";
import type { Scope } from "~/lib/scope";

export function opencodeCreateHandler(
  scope: Scope,
  fn: (scope: Scope, event: Event, signal: AbortSignal) => Promise<void>,
): (event: Event, signal: AbortSignal) => void {
  return (event, signal) => {
    scope.floatingPromises.track(
      fn(scope, event, signal).catch((error) => {
        logger.fatal("Failed to process event from OpenCode", error, {
          event,
        });
        scope.shutdown.trigger();
      }),
    );
  };
}
