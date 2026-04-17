import { expect, it } from "vitest";

import { serverPort } from "~/lib/server-port";
import { serverURL } from "~/lib/server-url";

it("defines the hard-coded local server port", () => {
  expect(serverPort).toBe(41237);
});

it("builds the local server URL from the server port", () => {
  expect(serverURL).toBe(`http://localhost:${serverPort}`);
});
