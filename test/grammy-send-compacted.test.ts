import { expect, test, vi } from "vitest";
import * as grammyFormatCompactedModule from "~/lib/grammy-format-compacted";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendCompacted } from "~/lib/grammy-send-compacted";

test("formats compacted and sends chunks", async () => {
  const chunks = [{ text: "compacted" }];
  vi.spyOn(
    grammyFormatCompactedModule,
    "grammyFormatCompacted",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendCompacted({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(grammyFormatCompactedModule.grammyFormatCompacted).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
