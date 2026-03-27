import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { convert } from "telegram-markdown-v2";
import { formatAnd } from "~/lib/format-and";

function formatAlwaysAllow(request: PermissionRequest): string {
  const isWildcard = request.always.length === 1 && request.always[0] === "*";
  const parts = [
    "If you press **Allow (always)**, all",
    `\`${request.permission}\` requests`,
  ];
  if (!isWildcard) {
    parts.push(
      `matching ${formatAnd(...request.always.map((p) => `\`${p}\``))}`,
    );
  }
  parts.push("will be automatically allowed until the session is restarted.");
  return parts.join(" ");
}

export function grammyFormatPermissionPrompt(request: PermissionRequest) {
  const lines = ["_How would you like to proceed?_"];
  if (request.always.length > 0) {
    lines.push(formatAlwaysAllow(request));
  }
  return convert(lines.join("\n\n"));
}
