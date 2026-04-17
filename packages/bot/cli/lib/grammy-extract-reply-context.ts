import type { Context } from "grammy";

export function grammyExtractReplyContext(ctx: Context): string | undefined {
  const reply = ctx.message?.reply_to_message;
  if (!reply) return undefined;

  const text =
    ("text" in reply && reply.text) ||
    ("caption" in reply && reply.caption) ||
    undefined;
  if (!text) return undefined;

  const truncated = text.length > 300 ? `${text.slice(0, 300)}...` : text;
  const sender = reply.from?.first_name ?? reply.from?.username ?? "a message";

  return `[Replying to ${sender}: "${truncated}"]`;
}
