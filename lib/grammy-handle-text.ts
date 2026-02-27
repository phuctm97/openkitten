import type { Context, Filter } from "grammy";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";

type TextContext = Filter<Context, "message:text">;

export async function grammyHandleText(
  { opencodeClient, existingSessions, workingSessions, pendingPrompts }: Scope,
  ctx: TextContext,
): Promise<void> {
  const sessionId = await existingSessions.findOrCreate(
    ctx.chat.id,
    ctx.msg.message_thread_id || undefined,
  );

  // If the session has an active pending prompt, answer it.
  try {
    await pendingPrompts.answer({
      sessionId,
      text: ctx.message.text,
    });
    return;
  } catch (error) {
    if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
  }

  // Lock the session and send the message to OpenCode.
  await workingSessions.lock(sessionId, async () => {
    await opencodeClient.session.promptAsync(
      {
        sessionID: sessionId,
        parts: [{ type: "text", text: ctx.message.text }],
      },
      { throwOnError: true },
    );
  });
}
