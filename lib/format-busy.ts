import { formatMessage } from "~/lib/format-message";

export function formatBusy() {
  return formatMessage(
    "> \u23F3 The agent is busy.\n\n```tip\nYour message was not delivered. Wait for a response, then try again.\n```",
  );
}
