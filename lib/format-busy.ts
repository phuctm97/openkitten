import { formatMessage } from "~/lib/format-message";

export function formatBusy() {
  return formatMessage(
    "> ⏳ The agent is busy.\n\n```tip\nYour message was not delivered. Wait for a response, then try again.\n```",
  );
}
