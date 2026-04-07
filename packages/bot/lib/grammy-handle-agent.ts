import type { CommandContext, Context } from "grammy";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import { grammySendAgentList } from "~/lib/grammy-send-agent-list";
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

  // No argument: show current agent and available agents.
  if (!ctx.match) {
    const { data: config } = await opencodeClient.config.get(
      {},
      { throwOnError: true },
    );
    const currentAgent =
      getSessionAgent(database, sessionId) || config.default_agent || "build";
    await grammySendAgentList({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
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

  setSessionAgent(database, sessionId, agent.name);
  await grammySendAgentChanged({
    bot,
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
    replyToMessageId: ctx.msg.message_id,
    agent,
  });
}
