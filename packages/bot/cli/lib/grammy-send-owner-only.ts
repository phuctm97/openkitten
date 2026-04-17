import { grammyFormatOwnerOnly } from "~/lib/grammy-format-owner-only";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendOwnerOnly(
  options: GrammySendOptions,
): Promise<void> {
  const chunks = grammyFormatOwnerOnly();
  await grammySendChunks({ ...options, chunks });
}
