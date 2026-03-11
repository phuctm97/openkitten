import { formatMessage } from "~/lib/format-message";

export function formatStart(sessionId: string, isNew: boolean) {
  const status = isNew
    ? "✨ New session created."
    : "👋 Existing session resumed.";
  return formatMessage(`> ${status}\n\n\`\`\`id\n${sessionId}\n\`\`\``);
}
