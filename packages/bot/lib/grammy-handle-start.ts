import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { CommandContext, Context } from "grammy";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyCheckOwner } from "~/lib/grammy-check-owner";
import { grammySendOwnerOnly } from "~/lib/grammy-send-owner-only";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

async function withMessages(
  opencodeClient: OpencodeClient,
  sessionId: string,
): Promise<boolean> {
  const { data: messages } = await opencodeClient.session.messages(
    { sessionID: sessionId, limit: 1 },
    { throwOnError: true },
  );
  return messages.length > 0;
}

async function withSession(
  { opencodeClient, existingSessions, workingSessions, pendingPrompts }: Scope,
  location: ExistingSessions.Location,
): Promise<string> {
  const existingSessionId = existingSessions.find(location);
  if (existingSessionId) {
    if (
      !workingSessions.check(existingSessionId) &&
      !pendingPrompts.check(existingSessionId) &&
      !(await withMessages(opencodeClient, existingSessionId))
    ) {
      return existingSessionId;
    }
    await existingSessions.remove(existingSessionId);
  }
  return existingSessions.find(location, { createIfNotFound: true });
}

export async function grammyHandleStart(
  scope: Scope,
  ctx: CommandContext<Context>,
  _signal: AbortSignal,
): Promise<void> {
  const location = {
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  };

  if (ctx.chat.type !== "private" && !grammyCheckOwner(ctx, scope.ownerId)) {
    await grammySendOwnerOnly({
      bot: scope.bot,
      chatId: location.chatId,
      threadId: location.threadId,
      replyToMessageId: ctx.msg.message_id,
    });
    return;
  }

  const sessionId = await withSession(scope, location);

  try {
    await scope.workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(scope.database, sessionId);
      await scope.opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [{ type: "text", text: ctx.match || "Hey" }],
        },
        { throwOnError: true },
      );
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot: scope.bot,
      chatId: location.chatId,
      threadId: location.threadId,
      replyToMessageId: ctx.msg.message_id,
    });
  }
}
