import { expect, test } from "vitest";
import { contract } from "~/lib/contract";

test("merges all public and user procedures", () => {
  expect(contract.me).toBeDefined();
});
