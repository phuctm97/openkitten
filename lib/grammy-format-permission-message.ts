import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { grammyFormatMessage } from "~/lib/grammy-format-message";

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

interface PermissionType {
  readonly emoji: string;
  readonly title: string;
  readonly description: string;
}

const permissionTypes: { readonly [key: string]: PermissionType } = {
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
  skill: {
    emoji: "⚡",
    title: "Run skill",
    description: "Execute a registered skill.",
  },
  todowrite: {
    emoji: "📝",
    title: "Update todos",
    description: "Update the todo list.",
  },
  todoread: {
    emoji: "📋",
    title: "Read todos",
    description: "Read the todo list.",
  },
  lsp: {
    emoji: "🔗",
    title: "Query LSP",
    description: "Query the language server for code intelligence.",
  },
};

function stringMeta(
  metadata: { readonly [key: string]: unknown },
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value ? value : undefined;
}

function numberMeta(
  metadata: { readonly [key: string]: unknown },
  key: string,
): number | undefined {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
}

function jsonMeta(
  metadata: { readonly [key: string]: unknown },
  key: string,
): string | undefined {
  const value = metadata[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function arrayMeta(
  metadata: { readonly [key: string]: unknown },
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
  const files = arrayMeta(request.metadata, "files") as
    | readonly EditFile[]
    | undefined;
  if (files) {
    lines.push("```patch");
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
  const subagentType = stringMeta(request.metadata, "subagent_type");
  if (subagentType) {
    lines.push("```agent");
    lines.push(subagentType);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
}

function formatWebfetch(lines: string[], request: PermissionRequest) {
  const url = stringMeta(request.metadata, "url");
  if (url) {
    lines.push("```url");
    lines.push(url);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
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
    lines.push(`${timeout} ${timeout === 1 ? "second" : "seconds"}`);
    lines.push("```");
  }
}

function formatWebsearch(lines: string[], request: PermissionRequest) {
  const query = stringMeta(request.metadata, "query");
  if (query) {
    lines.push("```query");
    lines.push(query);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
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
  const query = stringMeta(request.metadata, "query");
  if (query) {
    lines.push("```query");
    lines.push(query);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
  const tokensNum = numberMeta(request.metadata, "tokensNum");
  if (tokensNum) {
    lines.push("```limit");
    lines.push(`up to ${tokensNum} ${tokensNum === 1 ? "token" : "tokens"}`);
    lines.push("```");
  }
}

function formatExternalDirectory(lines: string[], request: PermissionRequest) {
  const filepath = stringMeta(request.metadata, "filepath");
  if (filepath) {
    lines.push("```path");
    lines.push(filepath);
    lines.push("```");
    return;
  }
  const parentDir = stringMeta(request.metadata, "parentDir");
  if (parentDir) {
    lines.push("```path");
    lines.push(parentDir);
    lines.push("```");
    return;
  }
  if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
}

function formatDoomLoop(lines: string[], request: PermissionRequest) {
  const tool = stringMeta(request.metadata, "tool");
  if (tool) {
    lines.push("```tool");
    lines.push(tool);
    lines.push("```");
  } else if (request.patterns.length > 0) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
  const input = jsonMeta(request.metadata, "input");
  if (input) {
    lines.push("```json");
    lines.push(input);
    lines.push("```");
  }
}

function formatSkill(lines: string[], request: PermissionRequest) {
  if (request.patterns.length > 0) {
    lines.push("```skill");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
}

function formatPattern(lines: string[], request: PermissionRequest) {
  const hasPatterns =
    request.patterns.length > 0 &&
    !(request.patterns.length === 1 && request.patterns[0] === "*");
  if (hasPatterns) {
    lines.push("```pattern");
    for (const p of request.patterns) {
      lines.push(p);
    }
    lines.push("```");
  }
}

function formatTool(lines: string[], request: PermissionRequest) {
  lines.push("```tool");
  lines.push(request.permission);
  lines.push("```");
  formatPattern(lines, request);
  if (Object.keys(request.metadata).length > 0) {
    lines.push("```json");
    lines.push(JSON.stringify(request.metadata, null, 2));
    lines.push("```");
  }
}

const permissionFormatters: {
  readonly [key: string]: (lines: string[], request: PermissionRequest) => void;
} = {
  bash: formatBash,
  read: formatRead,
  edit: formatEdit,
  grep: formatGrep,
  glob: formatGlob,
  list: formatList,
  task: formatTask,
  webfetch: formatWebfetch,
  websearch: formatWebsearch,
  codesearch: formatCodesearch,
  external_directory: formatExternalDirectory,
  doom_loop: formatDoomLoop,
  skill: formatSkill,
  todowrite: formatPattern,
  todoread: formatPattern,
  lsp: formatPattern,
};

export function grammyFormatPermissionMessage(request: PermissionRequest) {
  const known = permissionTypes[request.permission];
  const { emoji, title, description } = known ?? {
    emoji: "🔧",
    title: "Use tool",
    description: "The agent wants to use an unrecognized tool.",
  };
  const lines: string[] = [
    "> 🔒 The agent needs permission.\n",
    "\u2800",
    `${emoji} **${title}**`,
    `_${description}_`,
  ];

  const formatter = permissionFormatters[request.permission];
  if (formatter) {
    formatter(lines, request);
  } else {
    formatTool(lines, request);
  }

  return grammyFormatMessage(lines.join("\n"));
}
