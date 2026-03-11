import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { formatPermissionMessage } from "~/lib/format-permission-message";
import { formatPermissionPending } from "~/lib/format-permission-pending";
import { formatPermissionPrompt } from "~/lib/format-permission-prompt";
import { formatPermissionReplied } from "~/lib/format-permission-replied";

function makeRequest(
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, "permission" | "patterns">,
): PermissionRequest {
  return {
    id: "perm-1",
    sessionID: "session-1",
    metadata: {},
    always: [],
    ...overrides,
  };
}

describe("formatPermissionMessage", () => {
  it("formats bash with code block", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "bash",
          patterns: ["git status --porcelain", "npm test"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("The agent needs permission.");
    expect(text).toContain("Run command");
    expect(text).toContain("Execute a shell command on the system.");
    expect(text).toContain("git status --porcelain");
    expect(text).toContain("npm test");
    expect(text).toContain("```bash");
  });

  it("formats bash without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "bash",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run command");
    expect(text).not.toContain("```bash");
  });

  it("formats read without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "read", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Read contents");
    expect(text).not.toContain("```path");
  });

  it("formats read with path code block", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "read",
          patterns: ["src/main.ts"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("The agent needs permission.");
    expect(text).toContain("Read contents");
    expect(text).toContain("Read the contents of a file or folder.");
    expect(text).toContain("```path");
    expect(text).toContain("src/main.ts");
  });

  it("formats known permission without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "doom_loop",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated failures");
    expect(text).toContain(
      "Keep the session running despite repeated failures.",
    );
  });

  it("formats unknown permission with name and patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "custom_tool",
          patterns: ["pattern1"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Use tool");
    expect(text).not.toContain("Execute a shell command");
    expect(text).toContain("custom_tool");
    expect(text).toContain("pattern1");
  });

  it("formats unknown permission without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "custom_tool",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Use tool");
    expect(text).toContain("custom_tool");
  });

  it("formats glob with pattern and path from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "glob",
          patterns: ["**/*.ts"],
          metadata: { pattern: "**/*.ts", path: "/Users/foo/project/src" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).toContain("```pattern");
    expect(text).toContain("**/*.ts");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/project/src");
  });

  it("formats glob without metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "glob", patterns: ["**/*.ts"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).not.toContain("```pattern");
    expect(text).not.toContain("```path");
  });

  it("formats glob without path", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "glob",
          patterns: ["**/*.ts"],
          metadata: { pattern: "**/*.ts" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```path");
  });

  it("formats grep with pattern, path, and include from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "grep",
          patterns: ["TODO"],
          metadata: {
            pattern: "TODO",
            path: "/Users/foo/project",
            include: "*.ts",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find contents");
    expect(text).toContain("```pattern");
    expect(text).toContain("TODO");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/project");
    expect(text).toContain("```include");
    expect(text).toContain("*.ts");
  });

  it("formats grep without metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "grep", patterns: ["TODO"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find contents");
    expect(text).not.toContain("```pattern");
  });

  it("formats grep without path and include", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "grep",
          patterns: ["TODO"],
          metadata: { pattern: "TODO" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```path");
    expect(text).not.toContain("```include");
  });

  it("formats list with path from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "list",
          patterns: ["/Users/foo/project/src"],
          metadata: { path: "/Users/foo/project/src" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/project/src");
  });

  it("formats list without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "list", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).not.toContain("```path");
  });

  it("formats list without metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "list", patterns: ["/Users/foo/src"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/src");
  });

  it("formats task with description and type from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "task",
          patterns: ["code-reviewer"],
          metadata: {
            description: "Review the pull request",
            subagent_type: "code-reviewer",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Launch agent");
    expect(text).toContain("Spawn a sub-agent to handle a task.");
    expect(text).toContain("```description");
    expect(text).toContain("Review the pull request");
    expect(text).toContain("```agent");
    expect(text).toContain("code-reviewer");
  });

  it("formats task without metadata, falls back type to pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "task", patterns: ["general"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Launch agent");
    expect(text).not.toContain("```description");
    expect(text).toContain("```agent");
    expect(text).toContain("general");
  });

  it("formats task without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "task", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Launch agent");
    expect(text).not.toContain("```description");
    expect(text).not.toContain("```agent");
  });

  it("formats websearch without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "websearch", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Web search");
    expect(text).not.toContain("```query");
  });

  it("formats codesearch without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "codesearch", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Code search");
    expect(text).not.toContain("```query");
  });

  it("formats webfetch without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "webfetch", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Fetch URL");
    expect(text).not.toContain("```url");
  });

  it("formats webfetch with url, format, and timeout from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "webfetch",
          patterns: ["https://example.com"],
          metadata: {
            url: "https://example.com",
            format: "markdown",
            timeout: 30,
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Fetch URL");
    expect(text).toContain("Fetch content from a URL.");
    expect(text).toContain("```url");
    expect(text).toContain("https://example.com");
    expect(text).toContain("```format");
    expect(text).toContain("markdown");
    expect(text).toContain("```timeout");
    expect(text).toContain("30s");
  });

  it("formats webfetch without metadata, falls back url to pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "webfetch",
          patterns: ["https://example.com"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Fetch URL");
    expect(text).toContain("```url");
    expect(text).toContain("https://example.com");
    expect(text).not.toContain("```format");
    expect(text).not.toContain("```timeout");
  });

  it("formats websearch with all metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "websearch",
          patterns: ["effect typescript"],
          metadata: {
            query: "effect typescript",
            type: "deep",
            numResults: 10,
            livecrawl: "preferred",
            contextMaxCharacters: 5000,
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Web search");
    expect(text).toContain("Search the web for information.");
    expect(text).toContain("```query");
    expect(text).toContain("effect typescript");
    expect(text).toContain("```mode");
    expect(text).toContain("deep, live results preferred");
    expect(text).toContain("```limit");
    expect(text).toContain("up to 10 results / 5000 characters");
  });

  it("formats websearch without metadata, falls back query to pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "websearch",
          patterns: ["effect typescript"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Web search");
    expect(text).toContain("```query");
    expect(text).toContain("effect typescript");
    expect(text).not.toContain("```mode");
    expect(text).not.toContain("```limit");
  });

  it("formats websearch with fallback livecrawl", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "websearch",
          patterns: ["effect typescript"],
          metadata: {
            query: "effect typescript",
            livecrawl: "fallback",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```mode");
    expect(text).toContain("live results if needed");
  });

  it("formats codesearch with query and tokens from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "codesearch",
          patterns: ["effect typescript"],
          metadata: {
            query: "effect typescript",
            tokensNum: 10000,
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Code search");
    expect(text).toContain("Search the web for code examples.");
    expect(text).toContain("```query");
    expect(text).toContain("effect typescript");
    expect(text).toContain("```limit");
    expect(text).toContain("up to 10000 tokens");
  });

  it("formats codesearch without metadata, falls back query to pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "codesearch",
          patterns: ["effect typescript"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Code search");
    expect(text).toContain("```query");
    expect(text).toContain("effect typescript");
    expect(text).not.toContain("```limit");
  });

  it("formats multiple patterns in code block", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: ["/Users/foo/projects/*", "/Users/foo/.config/*"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/projects/*");
    expect(text).toContain("/Users/foo/.config/*");
  });

  it("formats edit with diff from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts"],
          metadata: {
            filepath: "/Users/foo/project/src/main.ts",
            diff: "--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1 +1 @@\n-old\n+new",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit file");
    expect(text).toContain("Modify the contents of a file.");
    expect(text).toContain("```diff");
    expect(text).toContain("-old");
    expect(text).toContain("+new");
  });

  it("formats edit without diff", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit file");
    expect(text).not.toContain("```diff");
  });

  it("formats external_directory with metadata directory", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: ["/Users/foo/projects/*"],
          metadata: {
            parentDir: "/Users/foo/projects",
            filepath: "/Users/foo/projects/file.ts",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).toContain("Access a path outside the project.");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/projects/*");
  });

  it("formats external_directory without metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: ["/Users/foo/projects/*"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/projects/*");
  });
});

describe("formatPermissionPending", () => {
  it("formats pending permission notification", () => {
    const chunks = Effect.runSync(formatPermissionPending());
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("A permission request needs your response.");
    expect(text).toContain("Respond to the pending permission request");
  });
});

describe("formatPermissionPrompt", () => {
  it("returns italic prompt text", () => {
    const text = formatPermissionPrompt();
    expect(text).toBe("_How would you like to proceed?_");
  });
});

describe("formatPermissionReplied", () => {
  it("formats 'once' reply", () => {
    expect(formatPermissionReplied("once")).toBe("✓ Allowed (once)");
  });

  it("formats 'always' reply", () => {
    expect(formatPermissionReplied("always")).toBe("✓ Allowed (always)");
  });

  it("formats 'reject' reply", () => {
    expect(formatPermissionReplied("reject")).toBe("✕ Denied");
  });
});
