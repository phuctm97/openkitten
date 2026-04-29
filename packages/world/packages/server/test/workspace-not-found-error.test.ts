import { expect, it } from "vitest";
import { WorkspaceNotFoundError } from "~/lib/workspace-not-found-error";

it("defaults the reason to house-missing", () => {
  const error = new WorkspaceNotFoundError();
  expect(error).toBeInstanceOf(Error);
  expect(error.reason).toBe("house-missing");
  expect(error.message).toBe("Failed to find workspace: house-missing");
});

it("preserves the reason when one is provided", () => {
  for (const reason of [
    "house-missing",
    "workspace-missing",
    "membership-missing",
    "auto-create-failed",
  ] as const) {
    const error = new WorkspaceNotFoundError(reason);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain(reason);
  }
});
