import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { convert } from "telegram-markdown-v2";

function formatAlwaysAllow(request: PermissionRequest): string[] {
  const always = request.always.length === 1 && request.always[0] === "*";
  const lines: string[] = [
    `If you press **Allow (always)**, ${always ? "all" : "matched"} \`${request.permission}\` requests will be allowed until the session is restarted.`,
  ];
  if (!always) {
    lines.push("```pattern");
    for (const pattern of request.always) {
      lines.push(pattern);
    }
    lines.push("```");
  }
  lines[lines.length - 1] += "\n";
  return lines;
}

export function grammyFormatPermissionPrompt(request: PermissionRequest) {
  const lines: string[] = [];
  if (request.always.length > 0) {
    lines.push(...formatAlwaysAllow(request));
  }
  lines.push("_How would you like to proceed?_");
  return convert(lines.join("\n"));
}
