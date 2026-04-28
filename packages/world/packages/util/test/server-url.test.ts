import { expect, test } from "vitest";
import { serverPort } from "~/lib/server-port";
import { serverURL } from "~/lib/server-url";

test("builds the local server URL from the server port", () => {
  expect(serverURL).toBe(`http://localhost:${serverPort}`);
});
