import { expect, test, vi } from "vitest";
import * as grammyFormatMessageModule from "~/lib/grammy-format-message";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendMessage } from "~/lib/grammy-send-message";

test("formats text and sends chunks", async () => {
  const chunks = [{ text: "hello" }];
  vi.spyOn(grammyFormatMessageModule, "grammyFormatMessage").mockReturnValue(
    chunks,
  );
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendMessage({
    bot: {} as never,
    text: "hello",
    chatId: 123,
    threadId: undefined,
    ignoreErrors: false,
  });
  expect(grammyFormatMessageModule.grammyFormatMessage).toHaveBeenCalledWith(
    "hello",
  );
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 123,
    threadId: undefined,
    ignoreErrors: false,
  });
});
