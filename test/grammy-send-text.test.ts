import { expect, test, vi } from "vitest";
import * as grammyFormatTextModule from "~/lib/grammy-format-text";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendText } from "~/lib/grammy-send-text";

test("formats text and sends chunks", async () => {
  const chunks = [{ text: "hello" }];
  vi.spyOn(grammyFormatTextModule, "grammyFormatText").mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendText({
    bot: {} as never,
    text: "hello",
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 101,
  });
  expect(grammyFormatTextModule.grammyFormatText).toHaveBeenCalledWith("hello");
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 101,
  });
});
