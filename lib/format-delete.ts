import { formatMessage } from "~/lib/format-message";

export function formatDelete() {
  return formatMessage(
    "> 🗑️ The session was deleted.\n\n```Tip\nSend a new message to start a fresh conversation.\n```",
  );
}
