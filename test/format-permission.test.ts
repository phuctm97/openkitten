import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { formatPermissionMessage } from "~/lib/format-permission-message";
import { formatPermissionPrompt } from "~/lib/format-permission-prompt";
import { formatPermissionReplied } from "~/lib/format-permission-replied";

describe("formatPermissionMessage", () => {
  it("formats permission with patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "bash",
        patterns: ["rm -rf /tmp/*", "ls -la"],
      }),
    );
    expect(chunks.length).toBeGreaterThan(0);
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("bash");
    expect(text).toContain("rm -rf /tmp/*");
    expect(text).toContain("ls -la");
  });

  it("formats permission without patterns", () => {
    const chunks = Effect.runSync(
      formatPermissionMessage({
        permission: "file_read",
        patterns: [],
      }),
    );
    expect(chunks.length).toBeGreaterThan(0);
    const text = chunks.map((c) => c.text).join("\n");
    expect(text).toContain("file_read");
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
    expect(formatPermissionReplied("once")).toBe("✓ Allowed once");
  });

  it("formats 'always' reply", () => {
    expect(formatPermissionReplied("always")).toBe("✓ Always allowed");
  });

  it("formats 'reject' reply", () => {
    expect(formatPermissionReplied("reject")).toBe("✕ Denied");
  });
});
