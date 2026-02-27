import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatQuestionPending() {
  return grammyFormatMessage(
    "> ❓ A question needs your answer.\n\n```tip\nAnswer the pending question before sending a new message.\n```",
  );
}
