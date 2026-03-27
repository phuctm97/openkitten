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

test("returns how to proceed prompt at end", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: ["*"] }),
  );
  const trimmed = result.trimEnd();
  expect(trimmed).toContain("How would you like to proceed");
  expect(trimmed.endsWith("_How would you like to proceed?_")).toBe(true);
});

test("omitted when always is empty", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: [] }),
  );
  expect(result).not.toContain("Allow \\(always\\)");
});

test("wildcard shows all requests allowed", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: ["*"] }),
  );
  expect(result).toContain("Allow \\(always\\)");
  expect(result).toContain("all");
  expect(result).toContain("requests");
  expect(result).toContain("allowed");
  expect(result).toContain("until the session is restarted");
  expect(result).not.toContain("```");
});

test("specific patterns listed in codeblock", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "bash", always: ["git commit *"] }),
  );
  expect(result).toContain("Allow \\(always\\)");
  expect(result).toContain("matched");
  expect(result).toContain("```");
  expect(result).toContain("git commit");
});

test("multiple specific patterns each on own line", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({
      permission: "bash",
      always: ["git commit *", "git push *"],
    }),
  );
  expect(result).toContain("git commit");
  expect(result).toContain("git push");
});

test("question appears after always-allow section", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "edit", always: ["*"] }),
  );
  const alwaysIdx = result.indexOf("Allow \\(always\\)");
  const questionIdx = result.indexOf("How would you like to proceed");
  expect(alwaysIdx).toBeGreaterThan(-1);
  expect(questionIdx).toBeGreaterThan(alwaysIdx);
});

test("only question when always is empty", () => {
  const result = grammyFormatPermissionPrompt(
    makeRequest({ permission: "bash", always: [] }),
  );
  expect(result).toContain("How would you like to proceed");
  expect(result).not.toContain("Allow \\(always\\)");
  expect(result).not.toContain("allowed");
});
