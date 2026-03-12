import { expect, test, vi } from "vitest";
import * as formatErrorModule from "~/lib/format-error";
import * as sendChunksModule from "~/lib/send-chunks";
import { sendError } from "~/lib/send-error";

test("formats error and sends chunks", async () => {
  const chunks = [{ text: "error" }];
  vi.spyOn(formatErrorModule, "formatError").mockReturnValue(chunks);
  vi.spyOn(sendChunksModule, "sendChunks").mockResolvedValue(undefined);
  const error = new Error("boom");
  await sendError({
    bot: {} as never,
    error,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
  expect(formatErrorModule.formatError).toHaveBeenCalledWith(error);
  expect(sendChunksModule.sendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    ignoreErrors: true,
    chatId: 456,
    threadId: 789,
  });
});
