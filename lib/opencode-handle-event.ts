import type { Event } from "@opencode-ai/sdk/v2";
import type { Scope } from "~/lib/scope";

export async function opencodeHandleEvent(
  { workingSessions, pendingPrompts, processingMessages }: Scope,
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
  }
}
