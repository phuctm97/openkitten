import { grammyFormatSessionCreated } from "~/lib/grammy-format-session-created";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendSessionCreatedOptions } from "~/lib/grammy-send-session-created-options";

export async function grammySendSessionCreated({
  sessionId,
  ...options
}: GrammySendSessionCreatedOptions): Promise<void> {
  const chunks = grammyFormatSessionCreated(sessionId);
  await grammySendChunks({ ...options, chunks });
}
