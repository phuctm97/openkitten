import { expect, test, vi } from "vitest";
import * as grammyFormatSessionCompactedModule from "~/lib/grammy-format-session-compacted";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendSessionCompacted } from "~/lib/grammy-send-session-compacted";

test("formats session compacted and sends chunks", async () => {
  const chunks = [{ text: "compacted" }];
  vi.spyOn(
    grammyFormatSessionCompactedModule,
    "grammyFormatSessionCompacted",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendSessionCompacted({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatSessionCompactedModule.grammyFormatSessionCompacted,
  ).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
