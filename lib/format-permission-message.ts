import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { formatMessage } from "~/lib/format-message";

const permissionTypes: Record<
  string,
  {
    readonly emoji: string;
    readonly title: string;
    readonly description: string;
  }
> = {
  bash: {
    emoji: "▶️",
    title: "Run command",
    description: "Execute a shell command on the system.",
  },
  read: {
    emoji: "📄",
    title: "Read file",
    description: "Read the contents of a file.",
  },
  edit: {
    emoji: "✏️",
    title: "Edit file",
    description: "Modify the contents of a file.",
  },
  glob: {
    emoji: "🗂",
    title: "Find files",
    description: "Search for files matching a pattern.",
  },
  grep: {
    emoji: "🔎",
    title: "Find contents",
    description: "Search file contents for a pattern.",
  },
  list: {
    emoji: "📁",
    title: "List directory",
    description: "List the contents of a directory.",
  },
  task: {
    emoji: "🤖",
    title: "Launch agent",
    description: "Spawn a sub-agent to handle a task.",
  },
  webfetch: {
    emoji: "🌐",
    title: "Fetch URL",
    description: "Fetch content from a URL.",
  },
  websearch: {
    emoji: "🔎",
    title: "Web search",
    description: "Search the web for information.",
  },
  codesearch: {
    emoji: "🔎",
    title: "Code search",
    description: "Search the web for code examples.",
  },
  external_directory: {
    emoji: "📂",
    title: "Access external directory",
    description: "Access a directory outside the project.",
  },
  doom_loop: {
    emoji: "🔄",
    title: "Continue after repeated failures",
    description: "Keep the session running despite repeated failures.",
  },
};

function stringMeta(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

function formatBash(lines: string[], request: PermissionRequest) {
  if (request.patterns.length > 0) {
    lines.push("```bash");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  }
}

function formatEdit(lines: string[], request: PermissionRequest) {
  const diff = stringMeta(request.metadata, "diff");
  if (diff) {
    lines.push("```diff");
    lines.push(diff);
    lines.push("```");
  }
}

function formatExternalDirectory(lines: string[], request: PermissionRequest) {
  const dir =
    stringMeta(request.metadata, "parentDir") ??
    stringMeta(request.metadata, "filepath");
  if (dir) {
    lines.push(`\`${dir}\``);
  }
  for (const pattern of request.patterns) {
    if (pattern !== dir) {
      lines.push(`\`${pattern}\``);
    }
  }
}

function formatGlob(lines: string[], request: PermissionRequest) {
  const pattern = stringMeta(request.metadata, "pattern");
  if (pattern) {
    lines.push("```pattern");
    lines.push(pattern);
    lines.push("```");
  }
  const dir = stringMeta(request.metadata, "path");
  if (dir) {
    lines.push("```path");
    lines.push(dir);
    lines.push("```");
  }
}

function formatGrep(lines: string[], request: PermissionRequest) {
  const pattern = stringMeta(request.metadata, "pattern");
  if (pattern) {
    lines.push("```pattern");
    lines.push(pattern);
    lines.push("```");
  }
  const dir = stringMeta(request.metadata, "path");
  if (dir) {
    lines.push("```path");
    lines.push(dir);
    lines.push("```");
  }
  const include = stringMeta(request.metadata, "include");
  if (include) {
    lines.push("```include");
    lines.push(include);
    lines.push("```");
  }
}

function formatRead(lines: string[], request: PermissionRequest) {
  if (request.patterns.length > 0) {
    lines.push("```path");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  }
}

function formatDefault(
  lines: string[],
  request: PermissionRequest,
  known: boolean,
) {
  if (!known) {
    lines.push(`\`${request.permission}\``);
  }
  for (const pattern of request.patterns) {
    lines.push(`\`${pattern}\``);
  }
}

export function formatPermissionMessage(request: PermissionRequest) {
  const known = permissionTypes[request.permission];
  const { emoji, title, description } = known ?? {
    emoji: "🔧",
    title: "Use tool",
    description: "",
  };
  const lines: string[] = [
    `> 🔒 The agent needs permission.\n`,
    "\u2800",
    `${emoji} **${title}**`,
  ];
  if (description) {
    lines.push(`_${description}_`);
  }

  if (request.permission === "bash") {
    formatBash(lines, request);
  } else if (request.permission === "read") {
    formatRead(lines, request);
  } else if (request.permission === "edit") {
    formatEdit(lines, request);
  } else if (request.permission === "glob") {
    formatGlob(lines, request);
  } else if (request.permission === "grep") {
    formatGrep(lines, request);
  } else if (request.permission === "external_directory") {
    formatExternalDirectory(lines, request);
  } else {
    formatDefault(lines, request, !!known);
  }

  return formatMessage(lines.join("\n"));
}
