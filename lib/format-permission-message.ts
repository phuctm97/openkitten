import { formatMessage } from "~/lib/format-message";

const permissionTypes: Record<
  string,
  { readonly emoji: string; readonly title: string }
> = {
  bash: { emoji: "▶️", title: "Run command" },
  read: { emoji: "📄", title: "Read file" },
  edit: { emoji: "✏️", title: "Edit file" },
  glob: { emoji: "🔍", title: "Glob files" },
  grep: { emoji: "🔍", title: "Search files" },
  list: { emoji: "📁", title: "List directory" },
  task: { emoji: "🤖", title: "Launch agent" },
  webfetch: { emoji: "🌐", title: "Fetch URL" },
  websearch: { emoji: "🔎", title: "Web search" },
  codesearch: { emoji: "🔎", title: "Code search" },
  external_directory: { emoji: "📂", title: "Access external directory" },
  doom_loop: { emoji: "🔄", title: "Continue after repeated failures" },
};

export function formatPermissionMessage(request: {
  readonly permission: string;
  readonly patterns: ReadonlyArray<string>;
}) {
  const known = permissionTypes[request.permission];
  const { emoji, title } = known ?? { emoji: "🔧", title: "Use tool" };
  const lines: string[] = [
    "> 🔒 The agent needs permission.",
    "",
    `${emoji} **${title}**`,
  ];

  if (request.permission === "bash" && request.patterns.length > 0) {
    lines.push("```bash");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  } else {
    if (!known) {
      lines.push(`\`${request.permission}\``);
    }
    for (const pattern of request.patterns) {
      lines.push(`\`${pattern}\``);
    }
  }

  return formatMessage(lines.join("\n"));
}
