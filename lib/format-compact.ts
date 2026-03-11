import { formatMessage } from "~/lib/format-message";

export function formatCompact() {
  return formatMessage(
    "> 🧹 The session was compacted.\n\n```info\nThe conversation history was summarized to free up context.\n```",
  );
}
