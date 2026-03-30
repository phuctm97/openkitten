import type { CommandContext, Context } from "grammy";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import { grammySendAgentList } from "~/lib/grammy-send-agent-list";
import { grammySendAgentNotFound } from "~/lib/grammy-send-agent-not-found";
import type { Scope } from "~/lib/scope";

export async function grammyHandleAgent(
  { bot, opencodeClient, existingSessions, existingAgents }: Scope,
  ctx: CommandContext<Context>,
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
  const availableAgents = allAgents.filter((a) => a.mode !== "subagent");

  // No argument: show current agent and available agents.
  if (!ctx.match) {
    const { data: config } = await opencodeClient.config.get(
      {},
      { throwOnError: true },
    );
    const currentAgent =
      existingAgents.get(sessionId) || config.default_agent || "build";
    await grammySendAgentList({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      currentAgent,
      availableAgents,
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

  existingAgents.set(sessionId, agent.name);
  await grammySendAgentChanged({
    bot,
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
    replyToMessageId: ctx.msg.message_id,
    agent,
  });
}
