import { expect, test, vi } from "vitest";
import * as grammyFormatOwnerOnlyModule from "~/lib/grammy-format-owner-only";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendOwnerOnly } from "~/lib/grammy-send-owner-only";

test("formats owner only and sends chunks", async () => {
  const chunks = [{ text: "owner only" }];
  vi.spyOn(
    grammyFormatOwnerOnlyModule,
    "grammyFormatOwnerOnly",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendOwnerOnly({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
  expect(grammyFormatOwnerOnlyModule.grammyFormatOwnerOnly).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
});
