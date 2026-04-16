import type { GroupMessage } from "~/lib/group-message-buffer";

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatContextLine(message: GroupMessage, botName: string): string {
  const name = message.isBot ? botName : message.fromName;
  return `${name}: ${truncate(message.text, 200)}`;
}

export function grammyFormatGroupPrompt(options: {
  senderName: string;
  text: string;
  trigger: "mention" | "reply";
  quotedText?: string | undefined;
  recentContext: readonly GroupMessage[];
  botName: string;
}): string {
  const parts: string[] = [];

  if (options.recentContext.length > 0) {
    const contextLines = options.recentContext.map((msg) =>
      formatContextLine(msg, options.botName),
    );
    parts.push(`[Group conversation]\n${contextLines.join("\n")}`);
  }

  if (options.quotedText !== undefined) {
    const quoted = truncate(options.quotedText, 300);
    if (options.trigger === "reply") {
      parts.push(
        `[${options.senderName} replied to ${options.botName}'s message: "${quoted}"]`,
      );
    } else {
      parts.push(
        `[${options.senderName} said to ${options.botName}, replying to: "${quoted}"]`,
      );
    }
  } else {
    parts.push(`[${options.senderName} said to ${options.botName}]:`);
  }

  parts.push(options.text);
  return parts.join("\n\n");
}
