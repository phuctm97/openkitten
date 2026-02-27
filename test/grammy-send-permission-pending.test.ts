import { expect, test, vi } from "vitest";
import * as grammyFormatPermissionPendingModule from "~/lib/grammy-format-permission-pending";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendPermissionPending } from "~/lib/grammy-send-permission-pending";

test("formats permission pending and sends chunks", async () => {
  const chunks = [{ text: "pending" }];
  vi.spyOn(
    grammyFormatPermissionPendingModule,
    "grammyFormatPermissionPending",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendPermissionPending({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatPermissionPendingModule.grammyFormatPermissionPending,
  ).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
