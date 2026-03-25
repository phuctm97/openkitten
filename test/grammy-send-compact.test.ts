import { expect, test, vi } from "vitest";
import * as grammyFormatCompactModule from "~/lib/grammy-format-compact";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendCompact } from "~/lib/grammy-send-compact";

test("formats compact and sends chunks", async () => {
  const chunks = [{ text: "compacted" }];
  vi.spyOn(grammyFormatCompactModule, "grammyFormatCompact").mockReturnValue(
    chunks,
  );
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendCompact({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(grammyFormatCompactModule.grammyFormatCompact).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
