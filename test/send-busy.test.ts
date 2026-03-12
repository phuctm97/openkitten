import { expect, test, vi } from "vitest";
import * as formatBusyModule from "~/lib/format-busy";
import { sendBusy } from "~/lib/send-busy";
import * as sendChunksModule from "~/lib/send-chunks";

test("formats busy and sends chunks", async () => {
  const chunks = [{ text: "busy" }];
  vi.spyOn(formatBusyModule, "formatBusy").mockReturnValue(chunks);
  vi.spyOn(sendChunksModule, "sendChunks").mockResolvedValue(undefined);
  await sendBusy({
    client: {} as never,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
  expect(formatBusyModule.formatBusy).toHaveBeenCalled();
  expect(sendChunksModule.sendChunks).toHaveBeenCalledWith({
    client: {} as never,
    chunks,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
});
