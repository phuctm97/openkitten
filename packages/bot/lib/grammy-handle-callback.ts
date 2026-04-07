import type { Context, Filter } from "grammy";
import invariant from "tiny-invariant";
import { grammyFormatAgentChanged } from "~/lib/grammy-format-agent-changed";
import type { Scope } from "~/lib/scope";
import { setSessionAgent } from "~/lib/set-session-agent";

type CallbackContext = Filter<Context, "callback_query:data">;

async function handleAgentCallback(
  { bot, database, opencodeClient, existingSessions }: Scope,
  ctx: CallbackContext,
  agentName: string,
): Promise<void> {
  const message = ctx.callbackQuery.message;
  invariant(message, "Expected callback query to have a message");

  const sessionId = existingSessions.find({
    chatId: message.chat.id,
    threadId: message.message_thread_id || undefined,
  });
  if (!sessionId) {
    await bot.api.answerCallbackQuery(ctx.callbackQuery.id, {
      text: "Session expired",
    });
    return;
  }

  const { data: allAgents } = await opencodeClient.app.agents(
    {},
    { throwOnError: true },
  );
  const agent = allAgents.find(
    (a) => a.name === agentName && a.mode !== "subagent" && a.hidden !== true,
  );
  if (!agent) {
    await bot.api.answerCallbackQuery(ctx.callbackQuery.id, {
      text: `Agent "${agentName}" is not available`,
    });
    return;
  }

  setSessionAgent(database, sessionId, agent.name);
  const chunks = grammyFormatAgentChanged(agent);
  const first = chunks[0];
  invariant(first?.markdown, "Expected agent changed to have markdown content");
  await bot.api.editMessageText(
    message.chat.id,
    message.message_id,
    first.markdown,
    {
      parse_mode: "MarkdownV2",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [] },
    },
  );
  await bot.api.answerCallbackQuery(ctx.callbackQuery.id);
}

export async function grammyHandleCallback(
  scope: Scope,
  ctx: CallbackContext,
  _signal: AbortSignal,
): Promise<void> {
  const data = ctx.callbackQuery.data;

  // Agent selection callback: ag:<agent_name>
  if (data.startsWith("ag:")) {
    await handleAgentCallback(scope, ctx, data.slice(3));
    return;
  }

  const message = ctx.callbackQuery.message;
  invariant(message, "Expected callback query to have a message");

  // Find the session for this chat — don't create one for stale buttons.
  const sessionId = scope.existingSessions.find({
    chatId: message.chat.id,
    threadId: message.message_thread_id || undefined,
  });
  if (!sessionId) {
    await scope.bot.api.answerCallbackQuery(ctx.callbackQuery.id, {
      text: "An error occurred: expired_session",
    });
    return;
  }

  // Forward the callback to the active pending prompt.
  await scope.pendingPrompts.answer({
    sessionId,
    callbackQueryId: ctx.callbackQuery.id,
    callbackQueryData: ctx.callbackQuery.data,
  });
}
