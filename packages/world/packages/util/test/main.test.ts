import { expect, test } from "vitest";
import {
  iconURL,
  serverPort,
  serverURL,
  websitePort,
  websiteURL,
  worldPort,
  worldURL,
} from "~/lib/main";

test("re-exports every world-util constant", () => {
  expect(serverPort).toBe(41237);
  expect(serverURL).toBe("http://localhost:41237");
  expect(worldPort).toBe(41238);
  expect(worldURL).toBe("http://localhost:41238");
  expect(websitePort).toBe(41239);
  expect(websiteURL).toBe("http://localhost:41239");
  expect(iconURL).toBe("http://localhost:41239/icon.png");
});
