import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { describe, expect, test } from "vitest";
import { grammyFormatPermissionMessage } from "~/lib/grammy-format-permission-message";

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

describe("bash", () => {
  test("formats bash with code block", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "bash",
        patterns: ["git status --porcelain", "npm test"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("The agent needs permission.");
    expect(text).toContain("Run command");
    expect(text).toContain("Execute a shell command on the system.");
    expect(text).toContain("git status --porcelain");
    expect(text).toContain("npm test");
    expect(text).toContain("```bash");
  });

  test("formats bash without patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "bash", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run command");
    expect(text).not.toContain("```bash");
  });
});

describe("read", () => {
  test("formats read with path code block", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "read", patterns: ["src/main.ts"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("The agent needs permission.");
    expect(text).toContain("Read contents");
    expect(text).toContain("Read the contents of a file or folder.");
    expect(text).toContain("```path");
    expect(text).toContain("src/main.ts");
  });

  test("formats read without patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "read", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Read contents");
    expect(text).not.toContain("```path");
  });
});

describe("edit", () => {
  test("formats edit with diff from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "edit",
        patterns: ["src/main.ts"],
        metadata: {
          filepath: "/Users/foo/project/src/main.ts",
          diff: "--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1 +1 @@\n-old\n+new",
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit files");
    expect(text).toContain("Modify the contents of one or more files.");
    expect(text).toContain("```diff");
    expect(text).toContain("-old");
    expect(text).toContain("+new");
  });

  test("formats edit with files metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "edit",
        patterns: ["src/main.ts"],
        metadata: {
          files: [
            { filePath: "/project/src/main.ts", type: "update", additions: 5 },
          ],
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```patch");
    expect(text).toContain("update /project/src/main.ts");
  });

  test("formats edit with multiple files including move", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "edit",
        patterns: [],
        metadata: {
          files: [
            { filePath: "/project/src/main.ts", type: "update", additions: 5 },
            { filePath: "/project/src/util.ts", type: "add", additions: 10 },
            { filePath: "/project/src/old.ts", type: "delete", deletions: 3 },
            {
              filePath: "/project/src/old.ts",
              type: "move",
              movePath: "/project/src/new.ts",
            },
          ],
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("update /project/src/main.ts");
    expect(text).toContain("add /project/src/util.ts");
    expect(text).toContain("delete /project/src/old.ts");
    expect(text).toContain("move /project/src/old.ts → /project/src/new.ts");
  });

  test("formats edit with filepath fallback", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "edit",
        patterns: ["src/main.ts"],
        metadata: { filepath: "/Users/foo/project/src/main.ts" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```file");
    expect(text).toContain("/Users/foo/project/src/main.ts");
  });

  test("formats edit with patterns fallback", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "edit", patterns: ["src/main.ts"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```pattern");
    expect(text).toContain("src/main.ts");
  });

  test("formats edit without anything", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "edit", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit files");
    expect(text).not.toContain("```diff");
    expect(text).not.toContain("```pattern");
  });
});

describe("grep", () => {
  test("formats grep with pattern, path, and include from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "grep",
        patterns: ["TODO"],
        metadata: {
          pattern: "TODO",
          path: "/Users/foo/project",
          include: "*.ts",
        },
      }),
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

  test("formats grep without metadata falls back to patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "grep", patterns: ["TODO"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).toContain("TODO");
  });

  test("formats grep without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "grep", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find contents");
    expect(text).not.toContain("```pattern");
  });

  test("formats grep without path and include", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "grep",
        patterns: ["TODO"],
        metadata: { pattern: "TODO" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```path");
    expect(text).not.toContain("```include");
  });
});

describe("glob", () => {
  test("formats glob with pattern and path from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "glob",
        patterns: ["**/*.ts"],
        metadata: { pattern: "**/*.ts", path: "/Users/foo/project/src" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).toContain("```pattern");
    expect(text).toContain("**/*.ts");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/project/src");
  });

  test("formats glob without metadata falls back to patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "glob", patterns: ["**/*.ts"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```path");
  });

  test("formats glob without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "glob", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).not.toContain("```pattern");
  });

  test("formats glob without path", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "glob",
        patterns: ["**/*.ts"],
        metadata: { pattern: "**/*.ts" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```path");
  });
});

describe("list", () => {
  test("formats list with path from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "list",
        patterns: ["/Users/foo/project/src"],
        metadata: { path: "/Users/foo/project/src" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/project/src");
  });

  test("formats list without metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "list", patterns: ["/Users/foo/src"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/src");
  });

  test("formats list without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "list", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).not.toContain("```path");
  });
});

describe("task", () => {
  test("formats task with description and type from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "task",
        patterns: ["code-reviewer"],
        metadata: {
          description: "Review the pull request",
          subagent_type: "code-reviewer",
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Launch agent");
    expect(text).toContain("```description");
    expect(text).toContain("Review the pull request");
    expect(text).toContain("```agent");
    expect(text).toContain("code-reviewer");
  });

  test("formats task without metadata falls back to pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "task", patterns: ["general"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```description");
    expect(text).not.toContain("```agent");
    expect(text).toContain("```pattern");
    expect(text).toContain("general");
  });

  test("formats task without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "task", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Launch agent");
    expect(text).not.toContain("```description");
    expect(text).not.toContain("```agent");
  });
});

describe("webfetch", () => {
  test("formats webfetch with url, format, and timeout from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "webfetch",
        patterns: ["https://example.com"],
        metadata: {
          url: "https://example.com",
          format: "markdown",
          timeout: 30,
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Fetch URL");
    expect(text).toContain("```url");
    expect(text).toContain("https://example.com");
    expect(text).toContain("```format");
    expect(text).toContain("markdown");
    expect(text).toContain("```timeout");
    expect(text).toContain("30 seconds");
  });

  test("formats webfetch with singular timeout", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "webfetch",
        patterns: [],
        metadata: { url: "https://example.com", timeout: 1 },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("1 second");
    expect(text).not.toContain("seconds");
  });

  test("formats webfetch without metadata falls back to pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "webfetch",
        patterns: ["https://example.com"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```url");
    expect(text).toContain("```pattern");
    expect(text).toContain("https://example.com");
  });

  test("formats webfetch without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "webfetch", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Fetch URL");
    expect(text).not.toContain("```url");
  });
});

describe("websearch", () => {
  test("formats websearch with all metadata", () => {
    const chunks = grammyFormatPermissionMessage(
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
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Web search");
    expect(text).toContain("```query");
    expect(text).toContain("effect typescript");
    expect(text).toContain("```mode");
    expect(text).toContain("deep, live results preferred");
    expect(text).toContain("```limit");
    expect(text).toContain("up to 10 results / 5000 characters");
  });

  test("formats websearch with fallback livecrawl", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "websearch",
        patterns: [],
        metadata: { query: "effect typescript", livecrawl: "fallback" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```mode");
    expect(text).toContain("live results if needed");
  });

  test("formats websearch without metadata falls back to pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "websearch", patterns: ["effect typescript"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```query");
    expect(text).toContain("```pattern");
    expect(text).toContain("effect typescript");
  });

  test("formats websearch without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "websearch", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Web search");
    expect(text).not.toContain("```query");
  });
});

describe("codesearch", () => {
  test("formats codesearch with query and tokens from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "codesearch",
        patterns: ["effect typescript"],
        metadata: { query: "effect typescript", tokensNum: 10000 },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Code search");
    expect(text).toContain("```query");
    expect(text).toContain("```limit");
    expect(text).toContain("up to 10000 tokens");
  });

  test("formats codesearch with singular token", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "codesearch",
        patterns: [],
        metadata: { query: "test", tokensNum: 1 },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("up to 1 token");
    expect(text).not.toContain("tokens");
  });

  test("formats codesearch without metadata falls back to pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "codesearch",
        patterns: ["effect typescript"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```query");
    expect(text).toContain("```pattern");
    expect(text).not.toContain("```limit");
  });

  test("formats codesearch without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "codesearch", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Code search");
    expect(text).not.toContain("```query");
  });
});

describe("external_directory", () => {
  test("formats with filepath from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "external_directory",
        patterns: ["/Users/foo/projects/*"],
        metadata: {
          parentDir: "/Users/foo/projects",
          filepath: "/Users/foo/projects/file.ts",
        },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/projects/file.ts");
    expect(text).not.toContain("```pattern");
  });

  test("formats with parentDir fallback", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "external_directory",
        patterns: ["/Users/foo/projects/*"],
        metadata: { parentDir: "/Users/foo/projects" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/projects");
    expect(text).not.toContain("```pattern");
  });

  test("formats without metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "external_directory",
        patterns: ["/Users/foo/projects/*"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/projects/*");
  });

  test("formats with multiple patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "external_directory",
        patterns: ["/Users/foo/projects/*", "/Users/foo/.config/*"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("/Users/foo/projects/*");
    expect(text).toContain("/Users/foo/.config/*");
  });

  test("formats without patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "external_directory", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).not.toContain("```pattern");
  });
});

describe("doom_loop", () => {
  test("formats with tool and input from metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "doom_loop",
        patterns: ["bash"],
        metadata: { tool: "bash", input: { command: "git status" } },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated calls");
    expect(text).toContain("```tool");
    expect(text).toContain("bash");
    expect(text).toContain("```json");
    expect(text).toContain("git status");
  });

  test("formats with string input", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "doom_loop",
        patterns: ["bash"],
        metadata: { tool: "bash", input: "git status" },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```json");
    expect(text).toContain("git status");
  });

  test("formats without metadata falls back to pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "doom_loop", patterns: ["bash"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```tool");
    expect(text).toContain("```pattern");
    expect(text).toContain("bash");
    expect(text).not.toContain("```json");
  });

  test("formats without metadata or patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "doom_loop", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated calls");
    expect(text).not.toContain("```tool");
    expect(text).not.toContain("```json");
  });
});

describe("skill", () => {
  test("formats with pattern", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "skill", patterns: ["deploy"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run skill");
    expect(text).toContain("```skill");
    expect(text).toContain("deploy");
  });

  test("formats without patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "skill", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run skill");
    expect(text).not.toContain("```skill");
  });
});

describe("todowrite", () => {
  test("formats todowrite", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "todowrite", patterns: ["*"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Update todos");
    expect(text).not.toContain("```pattern");
  });
});

describe("todoread", () => {
  test("formats todoread", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "todoread", patterns: ["*"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Read todos");
    expect(text).not.toContain("```pattern");
  });
});

describe("lsp", () => {
  test("formats lsp", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "lsp", patterns: ["*"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Query LSP");
    expect(text).not.toContain("```pattern");
  });
});

describe("unknown permission", () => {
  test("formats with name and patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "custom_tool", patterns: ["pattern1"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Use tool");
    expect(text).toContain("The agent wants to use an unrecognized tool.");
    expect(text).toContain("```tool");
    expect(text).toContain("custom_tool");
    expect(text).toContain("```pattern");
    expect(text).toContain("pattern1");
  });

  test("formats with metadata", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({
        permission: "custom_tool",
        patterns: ["pattern1"],
        metadata: { foo: "bar", count: 42 },
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```json");
    expect(text).toContain('"foo": "bar"');
    expect(text).toContain('"count": 42');
  });

  test("formats without patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "custom_tool", patterns: [] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```tool");
    expect(text).toContain("custom_tool");
    expect(text).not.toContain("```pattern");
  });

  test("formats with wildcard pattern as no patterns", () => {
    const chunks = grammyFormatPermissionMessage(
      makeRequest({ permission: "custom_tool", patterns: ["*"] }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```tool");
    expect(text).not.toContain("```pattern");
  });
});
