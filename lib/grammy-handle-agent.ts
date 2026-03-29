import type { CommandContext, Context } from "grammy";
import { grammySendText } from "~/lib/grammy-send-text";
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

  const [{ data: allAgents }, { data: config }] = await Promise.all([
    opencodeClient.app.agents({}, { throwOnError: true }),
    opencodeClient.config.get({}, { throwOnError: true }),
  ]);
  const mainAgents = allAgents.filter((a) => a.mode !== "subagent");
  const availableAgents = `**Available agents:**\n${mainAgents
    .map((a) => `- \`${a.name}\`: ${a.description || "N/A"}`)
    .join("\n")}`;
  const defaultAgent = config.default_agent || "build";

  // No argument: show current agent and available agents.
  if (!ctx.match) {
    const current = existingAgents.get(sessionId) || defaultAgent;
    await grammySendText({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
      text: `**Current agent:** \`${current}\`\n\n${availableAgents}`,
    });
    return;
  }

  // Validate the agent name.
  const agent = mainAgents.find((a) => a.name === ctx.match);
  if (!agent) {
    await grammySendText({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
      text: `**Unknown agent:** \`${ctx.match}\`\n\n${availableAgents}`,
    });
    return;
  }

  existingAgents.set(sessionId, agent.name);
  await ctx.react("👍");
}
