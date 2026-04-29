import { expect, test } from "vitest";
import { createClient } from "~/lib/main";

test("re-exports createClient", () => {
  expect(typeof createClient).toBe("function");
});
