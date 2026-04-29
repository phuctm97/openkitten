import { expect, test } from "vitest";
import { workspace } from "~/lib/router/workspace";

test("aggregates the sync procedure under the workspace folder", () => {
  expect(workspace.sync).toBeDefined();
});
