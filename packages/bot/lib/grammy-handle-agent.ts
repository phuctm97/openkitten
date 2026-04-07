import type { CommandContext, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyFormatAgentList } from "~/lib/grammy-format-agent-list";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import { grammySendAgentNotFound } from "~/lib/grammy-send-agent-not-found";
import type { Scope } from "~/lib/scope";
import { setSessionAgent } from "~/lib/set-session-agent";

export async function grammyHandleAgent(
  { bot, database, opencodeClient, existingSessions }: Scope,
  ctx: CommandContext<Context>,
  _signal: AbortSignal,
): Promise<void> {
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  const { data: allAgents } = await opencodeClient.app.agents(
    {},
    { throwOnError: true },
  );
  const availableAgents = allAgents.filter(
    (agent) => agent.mode !== "subagent" && agent.hidden !== true,
  );

  // No argument: show current agent and inline keyboard to select.
  if (!ctx.match) {
    const { data: config } = await opencodeClient.config.get(
      {},
      { throwOnError: true },
    );
    const currentAgent =
      getSessionAgent(database, sessionId) || config.default_agent || "build";
    const chunks = grammyFormatAgentList(currentAgent, availableAgents);
    const keyboard = new InlineKeyboard();
    for (const agent of availableAgents) {
      const label =
        agent.name === currentAgent ? `✓ ${agent.name}` : agent.name;
      keyboard.text(label, `ag:${agent.name}`);
    }
    const first = chunks[0];
    invariant(first?.markdown, "Expected agent list to have markdown content");
    await bot.api.sendMessage(ctx.chat.id, first.markdown, {
      parse_mode: "MarkdownV2",
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
      ...(ctx.msg.message_thread_id && {
        message_thread_id: ctx.msg.message_thread_id,
      }),
      reply_parameters: { message_id: ctx.msg.message_id },
    });
    return;
  }

  // Validate the agent name.
  const agent = availableAgents.find((a) => a.name === ctx.match);
  if (!agent) {
    await grammySendAgentNotFound({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
      name: ctx.match,
    });
    return;
  }

  setSessionAgent(database, sessionId, agent.name);
  await grammySendAgentChanged({
    bot,
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
    replyToMessageId: ctx.msg.message_id,
    agent,
  });
}
