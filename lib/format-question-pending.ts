import { formatMessage } from "~/lib/format-message";

export function formatQuestionPending() {
  return formatMessage(
    "> ❓ A question needs your answer.\n\n```Tip\nAnswer the pending question before sending a new message.\n```",
  );
}
