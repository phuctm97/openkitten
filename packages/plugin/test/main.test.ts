import { expect, test } from "vitest";
import {
  createBotClient,
  definePlugin,
  OpenkittenContext,
  readBotAPIConfig,
  tool,
} from "../lib/main";

test("exports definePlugin", () => {
  expect(typeof definePlugin).toBe("function");
});

test("exports tool", () => {
  expect(typeof tool).toBe("function");
});

test("exports createBotClient", () => {
  expect(typeof createBotClient).toBe("function");
});

test("exports OpenkittenContext", () => {
  expect(OpenkittenContext).toBeDefined();
});

test("exports readBotAPIConfig", () => {
  expect(typeof readBotAPIConfig).toBe("function");
});
