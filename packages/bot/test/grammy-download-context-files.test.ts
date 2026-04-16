import { beforeEach, expect, test, vi } from "vitest";
import { grammyDownloadContextFiles } from "~/lib/grammy-download-context-files";
import type { GroupMessage } from "~/lib/group-message-buffer";
import { modelSupportsFile } from "~/lib/model-supports-file";

vi.mock("~/lib/model-supports-file");

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = originalFetch;
});

const getFile = vi.fn(async () => ({
  file_id: "resolved-id",
  file_path: "photos/file.jpg",
}));

const bot = { api: { getFile }, token: "bot-token-123" } as never;

const writeStorage = vi.fn(
  async (_fileId: string, filename: string, _mime: string, _data: Uint8Array) =>
    `/saved/${filename}`,
);
const attachmentStorage = { write: writeStorage } as never;

function msg(overrides: Partial<GroupMessage> = {}): GroupMessage {
  return {
    fromName: "Alice",
    fromId: 1,
    text: "sent a photo",
    messageId: 42,
    timestamp: Date.now(),
    isBot: false,
    ...overrides,
  };
}

test("returns empty array when no files with fileId", async () => {
  const result = await grammyDownloadContextFiles(
    bot,
    {} as never,
    attachmentStorage,
    [msg()],
  );
  expect(result).toEqual([]);
});

test("returns empty array when context is empty", async () => {
  const result = await grammyDownloadContextFiles(
    bot,
    {} as never,
    attachmentStorage,
    [],
  );
  expect(result).toEqual([]);
});

test("downloads file when model supports it", async () => {
  vi.mocked(modelSupportsFile).mockResolvedValue(true);
  globalThis.fetch = vi.fn(
    async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
  ) as never;

  const result = await grammyDownloadContextFiles(
    bot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f1", fileMime: "image/jpeg" })],
  );

  expect(getFile).toHaveBeenCalledWith("f1");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    type: "file",
    mime: "image/jpeg",
  });
});

test("saves to disk when model does not support file", async () => {
  vi.mocked(modelSupportsFile).mockResolvedValue(false);
  globalThis.fetch = vi.fn(
    async () => new Response(new Uint8Array([4, 5, 6]), { status: 200 }),
  ) as never;

  const result = await grammyDownloadContextFiles(
    bot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f2", fileMime: "audio/ogg" })],
  );

  expect(writeStorage).toHaveBeenCalled();
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ type: "text" });
});

test("skips file when download returns non-ok", async () => {
  globalThis.fetch = vi.fn(
    async () => new Response(null, { status: 404 }),
  ) as never;

  const result = await grammyDownloadContextFiles(
    bot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f3", fileMime: "image/png" })],
  );

  expect(result).toEqual([]);
});

test("skips file when getFile throws", async () => {
  const badBot = {
    api: {
      getFile: vi.fn(async () => {
        throw new Error("network");
      }),
    },
    token: "t",
  } as never;

  const result = await grammyDownloadContextFiles(
    badBot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f4", fileMime: "image/png" })],
  );

  expect(result).toEqual([]);
});

test("uses bin extension when file path has no dots", async () => {
  vi.mocked(modelSupportsFile).mockResolvedValue(true);
  globalThis.fetch = vi.fn(
    async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
  ) as never;

  const noExtBot = {
    api: {
      getFile: vi.fn(async () => ({
        file_id: "resolved-id",
        file_path: "photos/noext",
      })),
    },
    token: "bot-token-123",
  } as never;

  const result = await grammyDownloadContextFiles(
    noExtBot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f-noext", fileMime: "image/jpeg" })],
  );

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    type: "file",
    filename: "context-42.bin",
  });
});

test("skips file when file_path is undefined", async () => {
  const noPathBot = {
    api: {
      getFile: vi.fn(async () => ({ file_id: "x", file_path: undefined })),
    },
    token: "t",
  } as never;

  const result = await grammyDownloadContextFiles(
    noPathBot,
    {} as never,
    attachmentStorage,
    [msg({ fileId: "f5", fileMime: "image/png" })],
  );

  expect(result).toEqual([]);
});
