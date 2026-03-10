import { formatMessage } from "~/lib/format-message";

export function formatPermissionMessage(request: {
  readonly permission: string;
  readonly patterns: ReadonlyArray<string>;
}) {
  const lines = [`> 🔒 ${request.permission}`];
  if (request.patterns.length > 0) {
    lines.push("");
    for (const pattern of request.patterns) {
      lines.push(`\`${pattern}\``);
    }
  }
  return formatMessage(lines.join("\n"));
}
