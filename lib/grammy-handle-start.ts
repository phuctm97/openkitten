import type { CommandContext, Context } from "grammy";
import type { Scope } from "~/lib/scope";

export async function grammyHandleStart(
  { opencodeClient, existingSessions, workingSessions }: Scope,
  ctx: CommandContext<Context>,
): Promise<void> {
  const location = {
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  };

  const existingSessionId = existingSessions.find(location);
  if (existingSessionId) {
    const { data: messages } = await opencodeClient.session.messages(
      { sessionID: existingSessionId, limit: 1 },
      { throwOnError: true },
    );
    if (messages.length > 0) {
      await existingSessions.remove(existingSessionId);
    }
  }

  const newSessionId = await existingSessions.findOrCreate(location);

  await Promise.all([
    workingSessions.lock(newSessionId, async () => {
      await opencodeClient.session.promptAsync(
        {
          sessionID: newSessionId,
          parts: [{ type: "text", text: ctx.match || "Hey" }],
        },
        { throwOnError: true },
      );
    }),
    ctx.react("👍"),
  ]);
}
