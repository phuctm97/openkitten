import { formatMessage } from "~/lib/format-message";

export function formatError(error: unknown) {
  const trace = Bun.inspect(error);
  return formatMessage(
    `> ❌ An error occurred.\n\n\`\`\`Trace\n${trace}\n\`\`\``,
  );
}
