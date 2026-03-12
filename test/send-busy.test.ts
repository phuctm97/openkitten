import { expect, test, vi } from "vitest";
import * as grammyFormatBusyModule from "~/lib/grammy-format-busy";
import { sendBusy } from "~/lib/send-busy";
import * as sendChunksModule from "~/lib/send-chunks";

test("formats busy and sends chunks", async () => {
  const chunks = [{ text: "busy" }];
  vi.spyOn(grammyFormatBusyModule, "grammyFormatBusy").mockReturnValue(chunks);
  vi.spyOn(sendChunksModule, "sendChunks").mockResolvedValue(undefined);
  await sendBusy({
    bot: {} as never,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
  expect(grammyFormatBusyModule.grammyFormatBusy).toHaveBeenCalled();
  expect(sendChunksModule.sendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
});
