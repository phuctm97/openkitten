import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function formatBusy() {
  return grammyFormatMessage(
    "> ⏳ The agent is busy.\n\n```tip\nYour message was not delivered. Wait for a response, then try again.\n```",
  );
}
