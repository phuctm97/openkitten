import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { formatMessage } from "~/lib/format-message";

/** Mirrors the per-file metadata shape from opencode's apply_patch tool. */
interface EditFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly type: "add" | "update" | "delete" | "move";
  readonly diff: string;
  readonly before: string;
  readonly after: string;
  readonly additions: number;
  readonly deletions: number;
  readonly movePath: string | undefined;
}

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
    emoji: "👁",
    title: "Read contents",
    description: "Read the contents of a file or folder.",
  },
  edit: {
    emoji: "✏️",
    title: "Edit files",
    description: "Modify the contents of one or more files.",
  },
  grep: {
    emoji: "🔎",
    title: "Find contents",
    description: "Search for file contents matching a pattern.",
  },
  glob: {
    emoji: "🗃",
    title: "Find files",
    description: "Search for file paths matching a pattern.",
  },
  list: {
    emoji: "📂",
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
    emoji: "🌍",
    title: "Web search",
    description: "Search the web for information.",
  },
  codesearch: {
    emoji: "📦",
    title: "Code search",
    description: "Search the web for code examples.",
  },
  external_directory: {
    emoji: "💾",
    title: "Access external directory",
    description: "Access a path outside the project.",
  },
  doom_loop: {
    emoji: "🔄",
    title: "Continue after repeated calls",
    description: "The same tool was called repeatedly with identical input.",
  },
};

function stringMeta(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

function numberMeta(
  metadata: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
}

function jsonMeta(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function arrayMeta(
  metadata: Record<string, unknown>,
  key: string,
): unknown[] | undefined {
  const value = metadata[key];
  return Array.isArray(value) && value.length > 0 ? value : undefined;
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

function formatRead(lines: string[], request: PermissionRequest) {
  if (request.patterns.length > 0) {
    lines.push("```path");
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
    return;
  }
  const files = arrayMeta(request.metadata, "files") as EditFile[] | undefined;
  if (files) {
    lines.push(files.length === 1 ? "```file" : "```files");
    for (const file of files) {
      if (file.type === "move") {
        lines.push(`${file.type} ${file.filePath} → ${file.movePath}`);
      } else {
        lines.push(`${file.type} ${file.filePath}`);
      }
    }
    lines.push("```");
    return;
  }
  const filepath = stringMeta(request.metadata, "filepath");
  if (filepath) {
    lines.push("```file");
    lines.push(filepath);
    lines.push("```");
    return;
  }
  if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  }
}

function formatGrep(lines: string[], request: PermissionRequest) {
  const pattern = stringMeta(request.metadata, "pattern");
  if (pattern) {
    lines.push("```pattern");
    lines.push(pattern);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
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

function formatGlob(lines: string[], request: PermissionRequest) {
  const pattern = stringMeta(request.metadata, "pattern");
  if (pattern) {
    lines.push("```pattern");
    lines.push(pattern);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
  const dir = stringMeta(request.metadata, "path");
  if (dir) {
    lines.push("```path");
    lines.push(dir);
    lines.push("```");
  }
}

function formatList(lines: string[], request: PermissionRequest) {
  const dir = stringMeta(request.metadata, "path");
  if (dir) {
    lines.push("```path");
    lines.push(dir);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
}

function formatTask(lines: string[], request: PermissionRequest) {
  const description = stringMeta(request.metadata, "description");
  if (description) {
    lines.push("```description");
    lines.push(description);
    lines.push("```");
  }
  const subagentType =
    stringMeta(request.metadata, "subagent_type") ?? request.patterns[0];
  if (subagentType) {
    lines.push("```agent");
    lines.push(subagentType);
    lines.push("```");
  }
}

function formatWebfetch(lines: string[], request: PermissionRequest) {
  const url = stringMeta(request.metadata, "url") ?? request.patterns[0];
  if (url) {
    lines.push("```url");
    lines.push(url);
    lines.push("```");
  }
  const format = stringMeta(request.metadata, "format");
  if (format) {
    lines.push("```format");
    lines.push(format);
    lines.push("```");
  }
  const timeout = numberMeta(request.metadata, "timeout");
  if (timeout) {
    lines.push("```timeout");
    lines.push(`${timeout}s`);
    lines.push("```");
  }
}

function formatWebsearch(lines: string[], request: PermissionRequest) {
  const query = stringMeta(request.metadata, "query") ?? request.patterns[0];
  if (query) {
    lines.push("```query");
    lines.push(query);
    lines.push("```");
  }
  const type = stringMeta(request.metadata, "type");
  const livecrawl = stringMeta(request.metadata, "livecrawl");
  const modeParts: string[] = [];
  if (type) modeParts.push(type);
  if (livecrawl === "preferred") modeParts.push("live results preferred");
  else if (livecrawl === "fallback") modeParts.push("live results if needed");
  if (modeParts.length > 0) {
    lines.push("```mode");
    lines.push(modeParts.join(", "));
    lines.push("```");
  }
  const numResults = numberMeta(request.metadata, "numResults");
  const maxChars = numberMeta(request.metadata, "contextMaxCharacters");
  const limits: string[] = [];
  if (numResults) limits.push(`${numResults} results`);
  if (maxChars) limits.push(`${maxChars} characters`);
  if (limits.length > 0) {
    lines.push("```limit");
    lines.push(`up to ${limits.join(" / ")}`);
    lines.push("```");
  }
}

function formatCodesearch(lines: string[], request: PermissionRequest) {
  const query = stringMeta(request.metadata, "query") ?? request.patterns[0];
  if (query) {
    lines.push("```query");
    lines.push(query);
    lines.push("```");
  }
  const tokensNum = numberMeta(request.metadata, "tokensNum");
  if (tokensNum) {
    lines.push("```limit");
    lines.push(`up to ${tokensNum} tokens`);
    lines.push("```");
  }
}

function formatExternalDirectory(lines: string[], request: PermissionRequest) {
  if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  }
}

function formatDoomLoop(lines: string[], request: PermissionRequest) {
  const tool = stringMeta(request.metadata, "tool") ?? request.patterns[0];
  if (tool) {
    lines.push("```tool");
    lines.push(tool);
    lines.push("```");
  }
  const input = jsonMeta(request.metadata, "input");
  if (input) {
    lines.push("```json");
    lines.push(input);
    lines.push("```");
  }
}

function formatDefault(lines: string[], request: PermissionRequest) {
  lines.push("```tool");
  lines.push(request.permission);
  lines.push("```");
  if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const pattern of request.patterns) {
      lines.push(pattern);
    }
    lines.push("```");
  }
  if (Object.keys(request.metadata).length > 0) {
    lines.push("```json");
    lines.push(JSON.stringify(request.metadata, null, 2));
    lines.push("```");
  }
}

export function formatPermissionMessage(request: PermissionRequest) {
  const known = permissionTypes[request.permission];
  const { emoji, title, description } = known ?? {
    emoji: "🔧",
    title: "Use tool",
    description: "The agent wants to use an unrecognized tool.",
  };
  const lines: string[] = [
    `> 🔒 The agent needs permission.\n`,
    "\u2800",
    `${emoji} **${title}**`,
  ];
  lines.push(`_${description}_`);

  if (request.permission === "bash") {
    formatBash(lines, request);
  } else if (request.permission === "read") {
    formatRead(lines, request);
  } else if (request.permission === "edit") {
    formatEdit(lines, request);
  } else if (request.permission === "grep") {
    formatGrep(lines, request);
  } else if (request.permission === "glob") {
    formatGlob(lines, request);
  } else if (request.permission === "list") {
    formatList(lines, request);
  } else if (request.permission === "task") {
    formatTask(lines, request);
  } else if (request.permission === "webfetch") {
    formatWebfetch(lines, request);
  } else if (request.permission === "websearch") {
    formatWebsearch(lines, request);
  } else if (request.permission === "codesearch") {
    formatCodesearch(lines, request);
  } else if (request.permission === "external_directory") {
    formatExternalDirectory(lines, request);
  } else if (request.permission === "doom_loop") {
    formatDoomLoop(lines, request);
  } else {
    formatDefault(lines, request);
  }

  return formatMessage(lines.join("\n"));
}
