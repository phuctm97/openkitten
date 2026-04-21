import { expect, test } from "vitest";
import { worldPort } from "~/lib/world-port";
import { worldURL } from "~/lib/world-url";

test("defines the local world URL", () => {
  expect(worldPort).toBe(41238);
  expect(worldURL).toBe(`http://localhost:${worldPort}`);
});
