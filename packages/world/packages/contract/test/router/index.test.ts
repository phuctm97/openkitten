import { expect, test } from "vitest";
import { workspace } from "~/lib/router";

test("re-exports the workspace folder as a nested router with sync", () => {
  expect(workspace.sync).toBeDefined();
});
