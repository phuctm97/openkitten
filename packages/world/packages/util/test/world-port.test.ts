import { expect, test } from "vitest";
import { worldPort } from "~/lib/world-port";

test("defines the hard-coded local world port", () => {
  expect(worldPort).toBe(41238);
});
