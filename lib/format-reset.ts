import { formatMessage } from "~/lib/format-message";

export function formatReset() {
  return formatMessage(
    "> 🔄 The session was reset.\n\n```tip\nSend a new message to start a fresh conversation.\n```",
  );
}
