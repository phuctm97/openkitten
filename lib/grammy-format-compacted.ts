import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatCompacted() {
  return grammyFormatMessage(
    "> 🧹 The session was compacted.\n\n```info\nThe conversation history was summarized to free up context.\n```",
  );
}
