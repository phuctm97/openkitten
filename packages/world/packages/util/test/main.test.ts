import { expect, test } from "vitest";
import {
  iconURL,
  isLive,
  isLocal,
  isMagicLinkEnabled,
  isPasskeyEnabled,
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
  expect(typeof isLocal).toBe("boolean");
  expect(typeof isLive).toBe("boolean");
  expect(isLive).toBe(!isLocal);
  expect(typeof isMagicLinkEnabled).toBe("boolean");
  expect(typeof isPasskeyEnabled).toBe("boolean");
});
