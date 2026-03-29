import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { CommandContext, Context } from "grammy";
import type { ExistingSessions } from "~/lib/existing-sessions";
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
): Promise<void> {
  const location = {
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  };

  const sessionId = await withSession(scope, location);

  await scope.workingSessions.lock(sessionId, async () => {
    await scope.opencodeClient.session.promptAsync(
      {
        sessionID: sessionId,
        parts: [{ type: "text", text: ctx.match || "Hey" }],
      },
      { throwOnError: true },
    );
  });
}
