import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatSessionPending() {
  return grammyFormatMessage(
    "> ⏳ A session response is pending.\n\n```tip\nWait for the current session response before sending a new message.\n```",
  );
}
