import { expect, test, vi } from "vitest";
import * as grammyFormatMessageModule from "~/lib/grammy-format-message";
import * as sendChunksModule from "~/lib/send-chunks";
import { sendMessage } from "~/lib/send-message";

test("formats text and sends chunks", async () => {
  const chunks = [{ text: "hello" }];
  vi.spyOn(grammyFormatMessageModule, "grammyFormatMessage").mockReturnValue(
    chunks,
  );
  vi.spyOn(sendChunksModule, "sendChunks").mockResolvedValue(undefined);
  await sendMessage({
    bot: {} as never,
    text: "hello",
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(grammyFormatMessageModule.grammyFormatMessage).toHaveBeenCalledWith(
    "hello",
  );
  expect(sendChunksModule.sendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
});
