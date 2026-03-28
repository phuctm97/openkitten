import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatSessionCompacted() {
  return grammyFormatText(
    "> 🧹 The session was compacted.\n\n```info\nThe conversation history was summarized to free up context.\n```",
  );
}
