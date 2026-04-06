import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { InputFile } from "grammy";
import { expect, test, vi } from "vitest";
import { grammyFormatText } from "~/lib/grammy-format-text";
import { grammySendAssistantMessage } from "~/lib/grammy-send-assistant-message";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

const info: AssistantMessage = {
  id: "m1",
  sessionID: "sess-1",
  role: "assistant",
  time: { created: 1, completed: 2 },
  parentID: "parent-1",
  modelID: "gpt-5",
  providerID: "openai",
  mode: "chat",
  agent: "default",
  path: { cwd: "/repo", root: "/repo" },
  cost: 0,
  tokens: {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  },
};

function createTextPart(text: string): Part {
  return {
    id: `text-${text}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "text",
    text,
  } as never;
}

function createFilePart(
  mime: string,
  filename?: string,
  payload = "AQ==",
): Extract<Part, { type: "file" }> {
  return {
    id: `file-${filename}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "file",
    mime,
    url: `data:${mime};base64,${payload}`,
    ...(filename ? { filename } : {}),
  };
}

function createCompletedToolPart(tool: string): Part {
  return {
    id: `tool-${tool}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "tool",
    callID: `call-${tool}`,
    tool,
    state: {
      status: "completed",
      input: {},
      output: "",
      title: `${tool} complete`,
      time: { start: 1, end: 2 },
      metadata: {},
      attachments: [],
    },
  } as never;
}

function createBot() {
  return {
    api: {
      sendAnimation: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
      sendAudio: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
      sendDocument: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
      sendMediaGroup: vi.fn(
        async (
          _chatId: number,
          _media: readonly unknown[],
          _options?: unknown,
        ) => [],
      ),
      sendPhoto: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
      sendSticker: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
      sendVideo: vi.fn(
        async (_chatId: number, _media: InputFile, _options?: unknown) => ({}),
      ),
    },
  };
}

test("sends text sections around grouped visual attachments in order", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createTextPart("Before"),
      createFilePart("image/png", "one.png"),
      createFilePart("video/mp4", "two.mp4"),
      createTextPart("After"),
    ],
    chatId: 123,
    threadId: 456,
    replyToMessageId: 101,
  });

  expect(grammySendChunksModule.grammySendChunks).toHaveBeenNthCalledWith(1, {
    bot,
    chatId: 123,
    chunks: grammyFormatText("Before"),
    replyToMessageId: 101,
    threadId: 456,
  });
  expect(bot.api.sendMediaGroup).toHaveBeenCalledWith(
    123,
    [
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "photo",
      }),
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "video",
      }),
    ],
    { message_thread_id: 456 },
  );
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenNthCalledWith(2, {
    bot,
    chatId: 123,
    chunks: grammyFormatText("After"),
    replyToMessageId: undefined,
    threadId: 456,
  });
});

test("uses the first attachment as the reply target when it is sent before text", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("image/png", "one.png"), createTextPart("Done")],
    chatId: 123,
    threadId: 456,
    replyToMessageId: 101,
  });

  expect(bot.api.sendPhoto).toHaveBeenCalledWith(123, expect.any(InputFile), {
    message_thread_id: 456,
    reply_parameters: { message_id: 101 },
  });
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    chunks: grammyFormatText("Done"),
    replyToMessageId: undefined,
    threadId: 456,
  });
});

test("skipActions omits action summaries while preserving text plans and files", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createTextPart("Before"),
      createCompletedToolPart("bash"),
      createCompletedToolPart("plan_enter"),
      createFilePart("image/png", "one.png"),
      createCompletedToolPart("plan_exit"),
      createTextPart("After"),
    ],
    chatId: 123,
    skipActions: true,
    threadId: 456,
    replyToMessageId: 101,
  });

  expect(grammySendChunksModule.grammySendChunks).toHaveBeenNthCalledWith(1, {
    bot,
    chatId: 123,
    chunks: grammyFormatText("Before\n\n🎯 _Entered plan mode._"),
    replyToMessageId: 101,
    threadId: 456,
  });
  expect(bot.api.sendPhoto).toHaveBeenCalledWith(123, expect.any(InputFile), {
    message_thread_id: 456,
  });
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenNthCalledWith(2, {
    bot,
    chatId: 123,
    chunks: grammyFormatText("🚪 _Exited plan mode._\n\nAfter"),
    replyToMessageId: undefined,
    threadId: 456,
  });
});

test("selects single-file Telegram methods for non-grouped attachments", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createFilePart("image/gif", "anim.gif"),
      createFilePart("audio/mpeg", "song.mp3"),
      createFilePart("application/pdf", "doc.pdf"),
      createFilePart("video/mp4", "clip.mp4"),
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendAnimation).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendAudio).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendDocument).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendVideo).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
});

test("treats non-gif images as photos and svg files as documents", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createFilePart("image/avif", "still.avif"),
      createFilePart("image/svg+xml", "vector.svg"),
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendPhoto).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendDocument).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
});

test("falls back to filename mime lookup when part mime is generic", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("application/octet-stream", "fallback.png")],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendPhoto).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
});

test("uses filename mime lookup to keep svg attachments as documents", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("application/octet-stream", "diagram.svg")],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendDocument).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendPhoto).not.toHaveBeenCalled();
});

test("routes tgs attachments through Telegram stickers", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createFilePart("application/x-tgsticker", "sticker.tgs"),
      createFilePart("application/x-tgsticker", "sticker.bin"),
      createFilePart("application/octet-stream", "fallback.tgs"),
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendSticker).toHaveBeenNthCalledWith(
    1,
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendSticker).toHaveBeenNthCalledWith(
    2,
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendSticker).toHaveBeenNthCalledWith(
    3,
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
  expect(bot.api.sendAnimation).not.toHaveBeenCalled();
});

test("falls back to generic part mime when filename lookup has no match", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("application/octet-stream", "blob")],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendDocument).toHaveBeenCalledWith(
    123,
    expect.any(InputFile),
    {},
  );
  expect(bot.api.sendPhoto).not.toHaveBeenCalled();
});

test("groups consecutive audio attachments when Telegram allows it", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createFilePart("audio/mpeg", "one.mp3"),
      createFilePart("audio/mpeg", "two.mp3"),
    ],
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 101,
  });

  expect(bot.api.sendMediaGroup).toHaveBeenCalledWith(
    123,
    [
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "audio",
      }),
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "audio",
      }),
    ],
    { reply_parameters: { message_id: 101 } },
  );
  expect(bot.api.sendAudio).not.toHaveBeenCalled();
});

test("groups consecutive document attachments when Telegram allows it", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createFilePart("application/pdf", "one.pdf"),
      createFilePart("application/pdf", "two.pdf"),
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendMediaGroup).toHaveBeenCalledWith(
    123,
    [
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "document",
      }),
      expect.objectContaining({
        media: expect.any(InputFile),
        type: "document",
      }),
    ],
    {},
  );
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
});

test("infers attachment filenames from mime type when needed", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("application/pdf"), createFilePart("made/up")],
    chatId: 123,
    threadId: undefined,
  });

  const firstMediaGroupCall = vi.mocked(bot.api.sendMediaGroup).mock.calls[0];
  if (!firstMediaGroupCall) throw new Error("Expected a media group call");

  const media = firstMediaGroupCall[1] as readonly { media: InputFile }[];
  expect(media[0]?.media).toMatchObject({ filename: "attachment-1.pdf" });
  expect(media[1]?.media).toMatchObject({ filename: "attachment-2" });
});

test("appends an inferred extension when the filename is missing one", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("image/png", "upload")],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendPhoto).toHaveBeenCalledWith(
    123,
    expect.objectContaining({ filename: "upload.png" }),
    {},
  );
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
});

test("ignores mime parameters when routing attachments", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [createFilePart("image/png; charset=utf-8", "with-params")],
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendPhoto).toHaveBeenCalledWith(
    123,
    expect.objectContaining({ filename: "with-params.png" }),
    {},
  );
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
});

test("splits media groups after Telegram's ten-item limit", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: Array.from({ length: 11 }, (_, index) =>
      createFilePart("image/png", `image-${index + 1}.png`),
    ),
    chatId: 123,
    threadId: undefined,
  });

  expect(bot.api.sendMediaGroup).toHaveBeenCalledTimes(1);
  const firstMediaGroupCall = vi.mocked(bot.api.sendMediaGroup).mock.calls[0];
  if (!firstMediaGroupCall) throw new Error("Expected a media group call");

  expect(firstMediaGroupCall[1]).toHaveLength(10);
  expect(bot.api.sendPhoto).toHaveBeenCalledTimes(1);
});

test("skips Telegram sends when nothing is visible or attachable", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      { type: "reasoning", text: "thinking", time: { start: 1 } } as never,
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(grammySendChunksModule.grammySendChunks).not.toHaveBeenCalled();
  expect(bot.api.sendAnimation).not.toHaveBeenCalled();
  expect(bot.api.sendAudio).not.toHaveBeenCalled();
  expect(bot.api.sendDocument).not.toHaveBeenCalled();
  expect(bot.api.sendMediaGroup).not.toHaveBeenCalled();
  expect(bot.api.sendPhoto).not.toHaveBeenCalled();
  expect(bot.api.sendSticker).not.toHaveBeenCalled();
  expect(bot.api.sendVideo).not.toHaveBeenCalled();
});

test("skips invisible inline-reference sections while still sending text", async () => {
  const bot = createBot();
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );

  await grammySendAssistantMessage({
    bot: bot as never,
    info,
    parts: [
      createTextPart("Open @README.md."),
      {
        id: "file-inline",
        sessionID: "sess-1",
        messageID: "m1",
        type: "file",
        mime: "text/plain",
        url: "file:///repo/README.md",
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "@README.md", start: 5, end: 15 },
        },
      } as never,
    ],
    chatId: 123,
    threadId: undefined,
  });

  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    chunks: grammyFormatText("Open <u>@README.md</u>."),
    replyToMessageId: undefined,
    threadId: undefined,
  });
  expect(bot.api.sendMediaGroup).not.toHaveBeenCalled();
});
