import type { Event } from "@opencode-ai/sdk/v2";
import { grammySendCompacted } from "~/lib/grammy-send-compacted";
import { grammySendError } from "~/lib/grammy-send-error";
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
      if (!sessionID) break;
      const location = existingSessions.resolve(sessionID);
      await grammySendError({ bot, error, ...location });
      break;
    }
    case "session.compacted": {
      const { sessionID } = event.properties;
      const location = existingSessions.resolve(sessionID);
      await grammySendCompacted({ bot, ...location });
      break;
    }
  }
}
