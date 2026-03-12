import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatError(error: unknown) {
  const trace = Bun.inspect(error);
  return grammyFormatMessage(
    `> ❌ An error occurred.\n\n\`\`\`trace\n${trace}\n\`\`\``,
  );
}
