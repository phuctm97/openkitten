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
  // bash

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

  // read

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

  // edit

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
    expect(text).toContain("Edit files");
    expect(text).toContain("Modify the contents of one or more files.");
    expect(text).toContain("```diff");
    expect(text).toContain("-old");
    expect(text).toContain("+new");
  });

  it("formats edit without diff, falls back to single file with type", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts"],
          metadata: {
            files: [
              {
                filePath: "/project/src/main.ts",
                relativePath: "src/main.ts",
                type: "update",
                additions: 5,
              },
            ],
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```patch");
    expect(text).toContain("update /project/src/main.ts");
  });

  it("formats edit without diff, falls back to multiple files with types", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts", "src/util.ts"],
          metadata: {
            files: [
              {
                filePath: "/project/src/main.ts",
                relativePath: "src/main.ts",
                type: "update",
                additions: 5,
              },
              {
                filePath: "/project/src/util.ts",
                relativePath: "src/util.ts",
                type: "add",
                additions: 10,
              },
              {
                filePath: "/project/src/old.ts",
                relativePath: "src/old.ts",
                type: "delete",
                deletions: 3,
              },
              {
                filePath: "/project/src/old.ts",
                relativePath: "src/new.ts",
                type: "move",
                movePath: "/project/src/new.ts",
              },
            ],
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```patch");
    expect(text).toContain("update /project/src/main.ts");
    expect(text).toContain("add /project/src/util.ts");
    expect(text).toContain("delete /project/src/old.ts");
    expect(text).toContain("move /project/src/old.ts → /project/src/new.ts");
  });

  it("formats edit without diff or files, falls back to filepath", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts"],
          metadata: { filepath: "/Users/foo/project/src/main.ts" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit files");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```file");
    expect(text).toContain("/Users/foo/project/src/main.ts");
  });

  it("formats edit without metadata, falls back to patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: ["src/main.ts"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit files");
    expect(text).not.toContain("```diff");
    expect(text).toContain("```pattern");
    expect(text).toContain("src/main.ts");
  });

  it("formats edit without anything", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "edit",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Edit files");
    expect(text).not.toContain("```diff");
    expect(text).not.toContain("```pattern");
  });

  // grep

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

  it("formats grep without metadata, falls back to patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "grep", patterns: ["TODO"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find contents");
    expect(text).toContain("```pattern");
    expect(text).toContain("TODO");
  });

  it("formats grep without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "grep", patterns: [] }),
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

  // glob

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

  it("formats glob without metadata, falls back to patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "glob", patterns: ["**/*.ts"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).toContain("```pattern");
    expect(text).toContain("**/*.ts");
    expect(text).not.toContain("```path");
  });

  it("formats glob without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "glob", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Find files");
    expect(text).not.toContain("```pattern");
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

  // list

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

  it("formats list without metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "list", patterns: ["/Users/foo/src"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("List directory");
    expect(text).toContain("```pattern");
    expect(text).toContain("/Users/foo/src");
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

  // task

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
    expect(text).not.toContain("```agent");
    expect(text).toContain("```pattern");
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

  // webfetch

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
    expect(text).toContain("30 seconds");
  });

  it("formats webfetch with singular timeout", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "webfetch",
          patterns: [],
          metadata: { url: "https://example.com", timeout: 1 },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("1 second");
    expect(text).not.toContain("seconds");
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
    expect(text).not.toContain("```url");
    expect(text).toContain("```pattern");
    expect(text).toContain("https://example.com");
    expect(text).not.toContain("```format");
    expect(text).not.toContain("```timeout");
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

  // websearch

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
    expect(text).not.toContain("```query");
    expect(text).toContain("```pattern");
    expect(text).toContain("effect typescript");
    expect(text).not.toContain("```mode");
    expect(text).not.toContain("```limit");
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

  // codesearch

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

  it("formats codesearch with singular token", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "codesearch",
          patterns: [],
          metadata: { query: "test", tokensNum: 1 },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("up to 1 token");
    expect(text).not.toContain("tokens");
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
    expect(text).not.toContain("```query");
    expect(text).toContain("```pattern");
    expect(text).toContain("effect typescript");
    expect(text).not.toContain("```limit");
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

  // external_directory

  it("formats external_directory with filepath from metadata", () => {
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
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/projects/file.ts");
    expect(text).not.toContain("```pattern");
  });

  it("formats external_directory with parentDir fallback", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: ["/Users/foo/projects/*"],
          metadata: { parentDir: "/Users/foo/projects" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```path");
    expect(text).toContain("/Users/foo/projects");
    expect(text).not.toContain("```pattern");
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

  it("formats external_directory with multiple patterns", () => {
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

  it("formats external_directory without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).not.toContain("```pattern");
  });

  // doom_loop

  it("formats doom_loop with tool and input from metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "doom_loop",
          patterns: ["bash"],
          metadata: {
            tool: "bash",
            input: { command: "git status" },
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated calls");
    expect(text).toContain(
      "The same tool was called repeatedly with identical input.",
    );
    expect(text).toContain("```tool");
    expect(text).toContain("bash");
    expect(text).toContain("```json");
    expect(text).toContain("git status");
  });

  it("formats doom_loop with string input", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "doom_loop",
          patterns: ["bash"],
          metadata: { tool: "bash", input: "git status" },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```json");
    expect(text).toContain("git status");
  });

  it("formats doom_loop without metadata, falls back tool to pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "doom_loop",
          patterns: ["bash"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated calls");
    expect(text).not.toContain("```tool");
    expect(text).toContain("```pattern");
    expect(text).toContain("bash");
    expect(text).not.toContain("```json");
  });

  it("formats doom_loop without metadata or patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "doom_loop",
          patterns: [],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated calls");
    expect(text).not.toContain("```tool");
    expect(text).not.toContain("```json");
  });

  // skill

  it("formats skill with pattern", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "skill", patterns: ["deploy"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run skill");
    expect(text).toContain("Execute a registered skill.");
    expect(text).toContain("```skill");
    expect(text).toContain("deploy");
  });

  it("formats skill without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "skill", patterns: [] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run skill");
    expect(text).not.toContain("```skill");
  });

  // todowrite

  it("formats todowrite", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "todowrite", patterns: ["*"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Update todos");
    expect(text).toContain("Update the todo list.");
    expect(text).not.toContain("```pattern");
  });

  // todoread

  it("formats todoread", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "todoread", patterns: ["*"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Read todos");
    expect(text).toContain("Read the todo list.");
    expect(text).not.toContain("```pattern");
  });

  // lsp

  it("formats lsp", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission: "lsp", patterns: ["*"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Query LSP");
    expect(text).toContain("Query the language server for code intelligence.");
    expect(text).not.toContain("```pattern");
  });

  // unknown / default

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
    expect(text).toContain("The agent wants to use an unrecognized tool.");
    expect(text).toContain("```tool");
    expect(text).toContain("custom_tool");
    expect(text).toContain("```pattern");
    expect(text).toContain("pattern1");
  });

  it("formats unknown permission with metadata", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "custom_tool",
          patterns: ["pattern1"],
          metadata: { foo: "bar", count: 42 },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```json");
    expect(text).toContain('"foo": "bar"');
    expect(text).toContain('"count": 42');
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
    expect(text).toContain("```tool");
    expect(text).toContain("custom_tool");
    expect(text).not.toContain("```pattern");
  });

  it("formats unknown permission with wildcard pattern as no patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "custom_tool",
          patterns: ["*"],
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("```tool");
    expect(text).toContain("custom_tool");
    expect(text).not.toContain("```pattern");
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
