import { expect, test } from "vitest";
import { workspace } from "~/lib/main";

test("re-exports the workspace router as a nested namespace with sync", () => {
  expect(workspace.sync).toBeDefined();
});
