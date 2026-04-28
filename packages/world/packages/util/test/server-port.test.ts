import { expect, test } from "vitest";
import { serverPort } from "~/lib/server-port";

test("defines the hard-coded local server port", () => {
  expect(serverPort).toBe(41237);
});
