import { grammyFormatAgentChanged } from "~/lib/grammy-format-agent-changed";
import type { GrammySendAgentChangedOptions } from "~/lib/grammy-send-agent-changed-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

export async function grammySendAgentChanged({
  agent,
  ...options
}: GrammySendAgentChangedOptions): Promise<void> {
  const chunks = grammyFormatAgentChanged(agent);
  await grammySendChunks({ ...options, chunks });
}
