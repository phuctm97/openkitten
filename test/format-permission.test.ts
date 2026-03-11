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
    expect(text).toContain("Read file");
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
    expect(text).toContain("Read file");
    expect(text).toContain("Read the contents of a file.");
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

  it.each([
    ["glob", "Glob files", "Search for files matching a pattern."],
    ["grep", "Search files", "Search file contents for a pattern."],
    ["list", "List directory", "List the contents of a directory."],
    ["task", "Launch agent", "Spawn a sub-agent to handle a task."],
    ["webfetch", "Fetch URL", "Fetch content from a URL."],
    ["websearch", "Web search", "Search the web for information."],
    ["codesearch", "Code search", "Search the web for code examples."],
  ])("formats %s with title and description", (permission, title, description) => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({ permission, patterns: ["test-pattern"] }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain(title);
    expect(text).toContain(description);
    expect(text).toContain("test-pattern");
  });

  it("formats multiple patterns as separate inline codes", () => {
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
    expect(text).toContain("Access a directory outside the project.");
    expect(text).toContain("/Users/foo/projects");
    expect(text).toContain("/Users/foo/projects/*");
  });

  it("formats external_directory without duplicate when pattern matches dir", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage(
        makeRequest({
          permission: "external_directory",
          patterns: ["/Users/foo/projects"],
          metadata: {
            parentDir: "/Users/foo/projects",
          },
        }),
      ),
    );
    const text = chunks.map((c) => c.text).join("\n");
    // Should show the dir once, not duplicated
    const matches = text.match(/\/Users\/foo\/projects/g);
    expect(matches).toHaveLength(1);
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
