import type { GlobalEvent } from "@opencode-ai/sdk/v2";
import { grammySendError } from "~/lib/grammy-send-error";
import { grammySendSessionCompacted } from "~/lib/grammy-send-session-compacted";
import { logger } from "~/lib/logger";
import type { Scope } from "~/lib/scope";

export async function opencodeHandleEvent(
  {
    bot,
    existingSessions,
    workingSessions,
    pendingPrompts,
    processingMessages,
  }: Scope,
  event: GlobalEvent,
  _signal: AbortSignal,
): Promise<void> {
  switch (event.payload.type) {
    case "session.status":
      await workingSessions.update(event.payload);
      break;
    case "question.asked":
    case "question.replied":
    case "question.rejected":
    case "permission.asked":
    case "permission.replied":
      await pendingPrompts.update(event.payload);
      break;
    case "message.updated":
    case "message.removed":
    case "message.part.updated":
    case "message.part.removed":
    case "message.part.delta":
      await processingMessages.update(event.payload);
      break;
    case "session.error": {
      const { sessionID, error } = event.payload.properties;
      logger.error("OpenCode session encountered an error", error, {
        sessionID,
      });
      if (sessionID) {
        const location = existingSessions.get(sessionID);
        if (!location) {
          logger.debug("Skipping OpenCode session error for removed session", {
            sessionID,
          });
          break;
        }
        await grammySendError({ bot, error, ...location });
      }
      break;
    }
    case "session.compacted": {
      const { sessionID } = event.payload.properties;
      const location = existingSessions.get(sessionID);
      if (!location) {
        logger.debug("Skipping compacted notice for removed session", {
          sessionID,
        });
        break;
      }
      await grammySendSessionCompacted({ bot, ...location });
      break;
    }
  }
}
