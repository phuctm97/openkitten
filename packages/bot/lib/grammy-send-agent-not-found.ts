import { grammyFormatAgentNotFound } from "~/lib/grammy-format-agent-not-found";
import type { GrammySendAgentNotFoundOptions } from "~/lib/grammy-send-agent-not-found-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

export async function grammySendAgentNotFound({
  name,
  ...options
}: GrammySendAgentNotFoundOptions): Promise<void> {
  const chunks = grammyFormatAgentNotFound(name);
  await grammySendChunks({ ...options, chunks });
}
