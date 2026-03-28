import { expect, test, vi } from "vitest";
import * as grammyFormatSessionPendingModule from "~/lib/grammy-format-session-pending";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";

test("formats session pending and sends chunks", async () => {
  const chunks = [{ text: "busy" }];
  vi.spyOn(
    grammyFormatSessionPendingModule,
    "grammyFormatSessionPending",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendSessionPending({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatSessionPendingModule.grammyFormatSessionPending,
  ).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
