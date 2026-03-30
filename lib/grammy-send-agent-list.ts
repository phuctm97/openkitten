import { grammyFormatAgentList } from "~/lib/grammy-format-agent-list";
import type { GrammySendAgentListOptions } from "~/lib/grammy-send-agent-list-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

export async function grammySendAgentList({
  currentAgent,
  availableAgents,
  ...options
}: GrammySendAgentListOptions): Promise<void> {
  const chunks = grammyFormatAgentList(currentAgent, availableAgents);
  await grammySendChunks({ ...options, chunks });
}
