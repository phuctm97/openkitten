import { formatMessage } from "~/lib/format-message";

export function formatStop() {
  return formatMessage(
    "> 🛑 The agent was stopped.\n\n```tip\nSend a new message to continue the conversation.\n```",
  );
}
