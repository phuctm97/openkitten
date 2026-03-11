import { formatMessage } from "~/lib/format-message";

export function formatPermissionPending() {
  return formatMessage(
    "> ❗ A permission request needs your response.\n\n```tip\nRespond to the pending permission request before sending a new message.\n```",
  );
}
