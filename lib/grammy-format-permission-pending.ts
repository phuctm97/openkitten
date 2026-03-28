import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatPermissionPending() {
  return grammyFormatText(
    "> ❗ A permission request needs your response.\n\n```tip\nRespond to the pending permission request before sending a new message.\n```",
  );
}
