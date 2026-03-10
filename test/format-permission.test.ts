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

  it("formats known permission with inline code", () => {
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
    expect(formatPermissionReplied("once")).toBe("✓ Allowed (Once)");
  });

  it("formats 'always' reply", () => {
    expect(formatPermissionReplied("always")).toBe("✓ Allowed (Always)");
  });

  it("formats 'reject' reply", () => {
    expect(formatPermissionReplied("reject")).toBe("✕ Denied");
  });
});
