import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatSessionPending() {
  return grammyFormatText(
    "> ⏳ The agent is busy.\n\n```tip\nYour message was not delivered. Wait for a response, then try again.\n```",
  );
}
