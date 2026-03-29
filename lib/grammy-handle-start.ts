import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { CommandContext, Context } from "grammy";
import { grammySendSessionCreated } from "~/lib/grammy-send-session-created";
import type { Scope } from "~/lib/scope";

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

export async function grammyHandleStart(
  {
    bot,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  }: Scope,
  ctx: CommandContext<Context>,
): Promise<void> {
  const location = {
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  };

  const existingSessionId = existingSessions.find(location);
  if (existingSessionId) {
    if (
      workingSessions.check(existingSessionId) ||
      pendingPrompts.check(existingSessionId) ||
      (await withMessages(opencodeClient, existingSessionId))
    ) {
      await existingSessions.remove(existingSessionId);
    }
  }

  const newSessionId = await existingSessions.find(location, {
    createIfNotFound: true,
  });

  await workingSessions.lock(newSessionId, async () => {
    if (newSessionId !== existingSessionId) {
      await grammySendSessionCreated({
        bot,
        sessionId: newSessionId,
        replyToMessageId: ctx.msg.message_id,
        ...location,
      });
    }

    await opencodeClient.session.promptAsync(
      {
        sessionID: newSessionId,
        parts: [{ type: "text", text: ctx.match || "Hey" }],
      },
      { throwOnError: true },
    );
  });
}
