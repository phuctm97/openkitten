import { expect, test, vi } from "vitest";
import * as grammyFormatBusyModule from "~/lib/grammy-format-busy";
import { grammySendBusy } from "~/lib/grammy-send-busy";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

test("formats busy and sends chunks", async () => {
  const chunks = [{ text: "busy" }];
  vi.spyOn(grammyFormatBusyModule, "grammyFormatBusy").mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendBusy({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
    ignoreErrors: true,
  });
  expect(grammyFormatBusyModule.grammyFormatBusy).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
    ignoreErrors: true,
  });
});
