import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatError(error: unknown) {
  const trace = Bun.inspect(error);
  return grammyFormatText(
    `> ❌ An error occurred.\n\n\`\`\`trace\n${trace}\n\`\`\``,
  );
}
