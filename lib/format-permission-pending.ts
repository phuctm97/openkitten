import { formatMessage } from "~/lib/format-message";

export function formatPermissionPending() {
  return formatMessage(
    "> ❗ A permission request needs your response.\n\n```Tip\nAllow or deny the pending permission before sending a new message.\n```",
  );
}
