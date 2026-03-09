import { formatMessage } from "~/lib/format-message";

export function formatBusy() {
  return formatMessage(
    "> \u23F3 The agent is busy.\n\n```Tip\nYour message was not delivered. Please wait for a response, then send it again.\n```",
  );
}
