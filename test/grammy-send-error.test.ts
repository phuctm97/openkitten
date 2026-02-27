import { expect, test, vi } from "vitest";
import * as grammyFormatErrorModule from "~/lib/grammy-format-error";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendError } from "~/lib/grammy-send-error";

test("formats error and sends chunks", async () => {
  const chunks = [{ text: "error" }];
  vi.spyOn(grammyFormatErrorModule, "grammyFormatError").mockReturnValue(
    chunks,
  );
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  const error = new Error("boom");
  await grammySendError({
    bot: {} as never,
    error,
    chatId: 456,
    threadId: 789,
  });
  expect(grammyFormatErrorModule.grammyFormatError).toHaveBeenCalledWith(error);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
