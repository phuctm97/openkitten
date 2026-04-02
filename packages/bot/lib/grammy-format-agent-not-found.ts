import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatAgentNotFound(name: string) {
  return grammyFormatText(
    `> ❌ There is no agent named \`${name}\`.\n\n\`\`\`tip\nUse /agent without arguments to see available agents.\n\`\`\``,
  );
}
