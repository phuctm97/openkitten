import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatPermissionPending() {
  return grammyFormatMessage(
    "> ❗ A permission request needs your response.\n\n```tip\nRespond to the pending permission request before sending a new message.\n```",
  );
}
