import type { Event } from "@opencode-ai/sdk/v2";
import { grammySendCompacted } from "~/lib/grammy-send-compacted";
import { grammySendError } from "~/lib/grammy-send-error";
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
  event: Event,
  _signal: AbortSignal,
): Promise<void> {
  switch (event.type) {
    case "session.status":
      await workingSessions.update(event);
      break;
    case "question.asked":
    case "permission.asked":
      await pendingPrompts.update(event);
      break;
    case "message.updated":
      await processingMessages.update(event);
      break;
    case "session.error": {
      const { sessionID, error } = event.properties;
      if (!sessionID || !existingSessions.check(sessionID)) {
        logger.debug("Ignored session.error for unknown session", {
          sessionID,
        });
        break;
      }
      const { chatId, threadId } = existingSessions.resolve(sessionID);
      await grammySendError({ bot, error, chatId, threadId });
      break;
    }
    case "session.compacted": {
      const { sessionID } = event.properties;
      if (!existingSessions.check(sessionID)) {
        logger.debug("Ignored session.compacted for unknown session", {
          sessionID,
        });
        break;
      }
      const { chatId, threadId } = existingSessions.resolve(sessionID);
      await grammySendCompacted({ bot, chatId, threadId });
      break;
    }
  }
}
