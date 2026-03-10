import { formatMessage } from "~/lib/format-message";

export function formatStop(sessionId: string) {
  return formatMessage(`> 🛑 Stopped.\n\n\`\`\`Session\n${sessionId}\n\`\`\``);
}
