import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatSessionCreated(sessionId: string) {
  return grammyFormatText(
    `> 🆕 A new session just started.\n\n\`\`\`id\n${sessionId}\n\`\`\``,
  );
}
