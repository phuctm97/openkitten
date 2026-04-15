import { expect, it } from "vitest";
import { serverPort } from "~/lib/server-port";
import { serverURL } from "~/lib/server-url";
import { websitePort } from "~/lib/website-port";
import { websiteURL } from "~/lib/website-url";
import { worldPort } from "~/lib/world-port";
import { worldURL } from "~/lib/world-url";

it("defines the hard-coded local server port", () => {
  expect(serverPort).toBe(41237);
});

it("builds the local server URL from the server port", () => {
  expect(serverURL).toBe(`http://localhost:${serverPort}`);
});

it("defines the hard-coded local world port", () => {
  expect(worldPort).toBe(41238);
});

it("builds the local world URL from the world port", () => {
  expect(worldURL).toBe(`http://localhost:${worldPort}`);
});

it("defines the hard-coded local website port", () => {
  expect(websitePort).toBe(41239);
});

it("builds the local website URL from the website port", () => {
  expect(websiteURL).toBe(`http://localhost:${websitePort}`);
});
