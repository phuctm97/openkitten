import { expect, test } from "vitest";
import { contract } from "~/lib/contract";

test("merges all public, user, and workspace procedures", () => {
  expect(contract.me).toBeDefined();
  expect(contract.workspace.sync).toBeDefined();
});
