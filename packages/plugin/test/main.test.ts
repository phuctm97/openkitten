import { expect, test } from "vitest";
import {
  createAPIProxy,
  definePlugin,
  OpenkittenContext,
  Telegram,
  tool,
} from "../lib/main";

test("exports definePlugin", () => {
  expect(typeof definePlugin).toBe("function");
});

test("exports tool", () => {
  expect(typeof tool).toBe("function");
});

test("exports createAPIProxy", () => {
  expect(typeof createAPIProxy).toBe("function");
});

test("exports OpenkittenContext", () => {
  expect(OpenkittenContext).toBeDefined();
});

test("exports Telegram", () => {
  expect(Telegram).toBeDefined();
});
