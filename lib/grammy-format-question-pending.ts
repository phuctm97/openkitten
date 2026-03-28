import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatQuestionPending() {
  return grammyFormatText(
    "> ❓ A question needs your answer.\n\n```tip\nAnswer the pending question before sending a new message.\n```",
  );
}
