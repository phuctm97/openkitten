import { expect, test } from "vitest";
import {
  createOpenKittenBotClient,
  getTelegramBotToken,
  readBotAPIConfig,
} from "../lib/main";

test("exports readBotAPIConfig", () => {
  expect(typeof readBotAPIConfig).toBe("function");
});

test("exports createOpenKittenBotClient", () => {
  expect(typeof createOpenKittenBotClient).toBe("function");
});

test("exports getTelegramBotToken", () => {
  expect(typeof getTelegramBotToken).toBe("function");
});
