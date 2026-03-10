import { formatMessage } from "~/lib/format-message";

export function formatStop(sessionId: string) {
  return formatMessage(
    `> 🛑 Session aborted.\n\n\`\`\`Session\n${sessionId}\n\`\`\``,
  );
}
