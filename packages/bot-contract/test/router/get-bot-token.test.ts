import { expect, test } from "vitest";
import { getBotToken } from "../../lib/router/get-bot-token";

test("getBotToken is defined", () => {
  expect(getBotToken).toBeDefined();
});

test("getBotToken has output schema that accepts strings", () => {
  const def = getBotToken["~orpc"];
  expect(def.outputSchema).toBeDefined();
  const result: unknown = def.outputSchema?.parse("test-token");
  expect(result).toBe("test-token");
});

test("getBotToken output schema rejects non-strings", () => {
  const def = getBotToken["~orpc"];
  expect(() => def.outputSchema?.parse(123)).toThrow();
});
