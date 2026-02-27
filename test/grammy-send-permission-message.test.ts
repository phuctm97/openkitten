import { expect, test, vi } from "vitest";
import * as grammyFormatPermissionMessageModule from "~/lib/grammy-format-permission-message";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendPermissionMessage } from "~/lib/grammy-send-permission-message";

test("formats permission message and sends chunks", async () => {
  const chunks = [{ text: "permission" }];
  const request = {
    id: "perm-1",
    sessionID: "sess-1",
    permission: "bash",
    patterns: ["git status"],
    metadata: {},
    always: [],
  };
  vi.spyOn(
    grammyFormatPermissionMessageModule,
    "grammyFormatPermissionMessage",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendPermissionMessage({
    bot: {} as never,
    request,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatPermissionMessageModule.grammyFormatPermissionMessage,
  ).toHaveBeenCalledWith(request);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
