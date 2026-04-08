import type { Context, Filter } from "grammy";
import type { CommandRegistry } from "~/lib/command-registry";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type TextContext = Filter<Context, "message:text">;

function expandPrompt(template: string, args: string): string {
  return template.replaceAll("{text}", args);
}

export async function grammyHandleCustomCommand(
  { bot, database, opencodeClient, existingSessions, workingSessions }: Scope,
  ctx: TextContext,
  _signal: AbortSignal,
  command: CommandRegistry.Command,
  args: string,
): Promise<void> {
  if (command.prompt.includes("{text}") && args === "") {
    await bot.api.sendMessage(ctx.chat.id, `Usage: /${command.name} <text>`, {
      ...(ctx.msg.message_thread_id && {
        message_thread_id: ctx.msg.message_thread_id,
      }),
      reply_parameters: { message_id: ctx.message.message_id },
    });
    return;
  }

  const chatId = ctx.chat.id;
  const threadId = ctx.msg.message_thread_id || undefined;
  const sessionId = await existingSessions.find(
    { chatId, threadId },
    { createIfNotFound: true },
  );

  const prompt = expandPrompt(command.prompt, args);

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [{ type: "text", text: prompt }],
        },
        { throwOnError: true },
      );
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot,
      chatId,
      threadId,
      replyToMessageId: ctx.message.message_id,
    });
  }
}
