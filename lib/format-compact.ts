import { formatMessage } from "~/lib/format-message";

export function formatCompact() {
  return formatMessage(
    "> 🧹 The session was compacted.\n\n```Info\nThe conversation history was summarized to free up context.\n```",
  );
}
