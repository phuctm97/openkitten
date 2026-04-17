import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatQuestionPending() {
  return grammyFormatText(
    "> ❓ A question needs your response.\n\n```tip\nRespond to the pending question before sending a new message.\n```",
  );
}
