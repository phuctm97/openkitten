import { expect, test } from "vitest";
import { telegramMessageMaxLength } from "~/lib/telegram-message-max-length";

test("matches Telegram's max message length", () => {
  expect(telegramMessageMaxLength).toBe(4096);
});
