import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";

function makeRequest(
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, "permission" | "always">,
): PermissionRequest {
  return {
    id: "perm-1",
    sessionID: "session-1",
    patterns: [],
    metadata: {},
    ...overrides,
  };
}

test("returns how to proceed prompt", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: ["*"] }),
  );
  expect(result).toContain("How would you like to proceed");
});

test("omitted when always is empty", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: [] }),
  );
  expect(result).not.toContain("Allow (always)");
});

test("wildcard shows all requests for known permission", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: ["*"] }),
  );
  expect(result).toContain("Allow");
  expect(result).toContain("edit");
  expect(result).toContain("automatically allowed");
  expect(result).toContain("until the session is restarted");
});

test("wildcard shows permission key for unknown permission", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "custom_mcp", always: ["*"] }),
  );
  expect(result).toContain("custom_mcp");
});

test("specific patterns listed for bash", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "bash", always: ["git commit *"] }),
  );
  expect(result).toContain("Allow");
  expect(result).toContain("bash");
  expect(result).toContain("git commit");
});

test("multiple specific patterns joined", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({
      permission: "bash",
      always: ["git commit *", "git push *"],
    }),
  );
  expect(result).toContain("git commit");
  expect(result).toContain("git push");
});
