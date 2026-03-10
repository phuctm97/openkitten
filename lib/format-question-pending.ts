import { formatMessage } from "~/lib/format-message";

export function formatQuestionPending() {
  return formatMessage(
    "> ❓ A question needs your answer.\n\n```Tip\nAnswer the question above before sending a new message.\n```",
  );
}
