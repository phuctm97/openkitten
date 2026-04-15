import { expect, test } from "vitest";
import * as main from "../lib/main";

test("exports createBotClient", () => {
  expect(main.createBotClient).toBeDefined();
});

test("exports contract", () => {
  expect(main.contract).toBeDefined();
  expect(main.contract.getBotToken).toBeDefined();
});
