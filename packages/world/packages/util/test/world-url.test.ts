import { expect, test } from "vitest";
import { worldPort } from "~/lib/world-port";
import { worldURL } from "~/lib/world-url";

test("builds the local world URL from the world port", () => {
  expect(worldURL).toBe(`http://localhost:${worldPort}`);
});
