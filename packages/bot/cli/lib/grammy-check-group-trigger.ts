import type { Context } from "grammy";

interface MentionTrigger {
  readonly type: "mention";
  readonly text: string;
  readonly quotedText?: string | undefined;
}

interface ReplyTrigger {
  readonly type: "reply";
  readonly text: string;
  readonly quotedText: string;
}

interface ContextTrigger {
  readonly type: "context";
}

export type GroupTriggerResult = MentionTrigger | ReplyTrigger | ContextTrigger;

function extractQuotedText(ctx: Context): string {
  const reply = ctx.message?.reply_to_message;
  const text = reply && "text" in reply ? reply.text : undefined;
  const caption = reply && "caption" in reply ? reply.caption : undefined;
  const content = text ?? caption ?? "";
  return content.length > 300 ? `${content.slice(0, 300)}...` : content;
}

function stripMentions(text: string, botUsername: string): string {
  const pattern = new RegExp(`@${botUsername}`, "gi");
  return text.replace(pattern, "").trim();
}

export function grammyCheckGroupTrigger(
  ctx: Context,
  botUsername: string,
  botId: number,
): GroupTriggerResult {
  const message = ctx.message;
  if (!message) return { type: "context" };

  // Priority 1: Reply to bot's message
  const replyTo = message.reply_to_message;
  if (replyTo?.from?.id === botId) {
    const text =
      "text" in message && message.text
        ? stripMentions(message.text, botUsername) || "Hey"
        : "caption" in message && message.caption
          ? stripMentions(message.caption, botUsername) || "Hey"
          : "Hey";
    return {
      type: "reply",
      text,
      quotedText: extractQuotedText(ctx),
    };
  }

  // Priority 2: @mention of the bot
  const entities = [
    ...((message.entities as {
      type: string;
      offset: number;
      length: number;
    }[]) ?? []),
    ...((message.caption_entities as
      | { type: string; offset: number; length: number }[]
      | undefined) ?? []),
  ];
  const fullText =
    ("text" in message && message.text) ||
    ("caption" in message && message.caption) ||
    "";
  const hasMention = entities.some(
    (entity) =>
      entity.type === "mention" &&
      fullText
        .slice(entity.offset, entity.offset + entity.length)
        .toLowerCase() === `@${botUsername.toLowerCase()}`,
  );

  if (hasMention) {
    const stripped = stripMentions(String(fullText), botUsername);
    const replyTo = message.reply_to_message;
    return {
      type: "mention",
      text: stripped || "Hey",
      quotedText: replyTo ? extractQuotedText(ctx) : undefined,
    };
  }

  // Priority 3: /command@botname (Telegram appends @botname when selecting from menu)
  const hasBotCommand = entities.some((entity) => {
    if (entity.type !== "bot_command") return false;
    const commandText = String(fullText).slice(
      entity.offset,
      entity.offset + entity.length,
    );
    return commandText.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
  });

  if (hasBotCommand) {
    const stripped = stripMentions(String(fullText), botUsername);
    const replyTo = message.reply_to_message;
    return {
      type: "mention",
      text: stripped || "Hey",
      quotedText: replyTo ? extractQuotedText(ctx) : undefined,
    };
  }

  // Not a trigger — context only
  return { type: "context" };
}
