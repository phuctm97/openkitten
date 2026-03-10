import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { formatPermissionMessage } from "~/lib/format-permission-message";
import { formatPermissionPrompt } from "~/lib/format-permission-prompt";
import { formatPermissionReplied } from "~/lib/format-permission-replied";

describe("formatPermissionMessage", () => {
  it("formats bash with code block", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "bash",
        patterns: ["git status --porcelain", "npm test"],
      }),
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
      formatPermissionMessage({
        permission: "bash",
        patterns: [],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Run command");
    expect(text).not.toContain("```bash");
  });

  it("formats known permission with inline code", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "read",
        patterns: ["src/main.ts"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("The agent needs permission.");
    expect(text).toContain("Read file");
    expect(text).toContain("src/main.ts");
  });

  it("formats known permission without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "doom_loop",
        patterns: [],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Continue after repeated failures");
  });

  it("formats unknown permission with name and patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "custom_tool",
        patterns: ["pattern1"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Use tool");
    expect(text).toContain("custom_tool");
    expect(text).toContain("pattern1");
  });

  it("formats unknown permission without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "custom_tool",
        patterns: [],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Use tool");
    expect(text).toContain("custom_tool");
  });

  it("formats multiple patterns as separate inline codes", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "external_directory",
        patterns: ["/Users/foo/projects/*", "/Users/foo/.config/*"],
      }),
    );
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Access external directory");
    expect(text).toContain("/Users/foo/projects/*");
    expect(text).toContain("/Users/foo/.config/*");
  });
});

describe("formatPermissionPrompt", () => {
  it("returns italic prompt text", () => {
    const text = formatPermissionPrompt();
    expect(text).toBe("_Allow this action?_");
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
