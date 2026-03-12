import { expect, test, vi } from "vitest";
import * as formatMessageModule from "~/lib/format-message";
import * as sendChunksModule from "~/lib/send-chunks";
import { sendMessage } from "~/lib/send-message";

test("formats text and sends chunks", async () => {
  const chunks = [{ text: "hello" }];
  vi.spyOn(formatMessageModule, "formatMessage").mockReturnValue(chunks);
  vi.spyOn(sendChunksModule, "sendChunks").mockResolvedValue(undefined);
  await sendMessage({
    client: {} as never,
    text: "hello",
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(formatMessageModule.formatMessage).toHaveBeenCalledWith("hello");
  expect(sendChunksModule.sendChunks).toHaveBeenCalledWith({
    client: {} as never,
    chunks,
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
});
