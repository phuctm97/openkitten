import { expect, test } from "vitest";
import { publicContract } from "~/lib/public-contract";

test("publicContract is exposed as an empty record ready for public procedures", () => {
  expect(publicContract).toStrictEqual({});
});
