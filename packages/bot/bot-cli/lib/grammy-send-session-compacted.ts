import { grammyFormatSessionCompacted } from "~/lib/grammy-format-session-compacted";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendSessionCompacted(
  options: GrammySendOptions,
): Promise<void> {
  const chunks = grammyFormatSessionCompacted();
  await grammySendChunks({ ...options, chunks });
}
