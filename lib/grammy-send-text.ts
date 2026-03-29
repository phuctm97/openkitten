import { grammyFormatText } from "~/lib/grammy-format-text";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendTextOptions } from "~/lib/grammy-send-text-options";

export async function grammySendText({
  text,
  ...options
}: GrammySendTextOptions): Promise<void> {
  const chunks = grammyFormatText(text);
  await grammySendChunks({ ...options, chunks });
}
