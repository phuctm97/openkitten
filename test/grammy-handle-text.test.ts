import { expect, test, vi } from "vitest";
import { createDatabase } from "~/lib/create-database";
import type { GrammyHandleContext } from "~/lib/grammy-handle-context";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import * as grammySendBusyModule from "~/lib/grammy-send-busy";
import { PendingPromptNotFoundError } from "~/lib/pending-prompt-not-found-error";
import * as schema from "~/lib/schema";

function mockCtx(chatId: number, text: string, threadId?: number) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: { text },
    update: { update_id: 1 },
  } as never;
}

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
      status: vi.fn(),
      promptAsync: vi.fn(),
    },
  };
}

function mockPendingPrompts() {
  return {
    sessionIds: [],
    invalidate: vi.fn(),
    flush: vi.fn(),
    answer: vi.fn(),
    resolve: vi.fn(),
    dismiss: vi.fn(),
    [Symbol.asyncDispose]: vi.fn(),
  };
}

test("answers pending prompt when session has one", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 42 }).run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "my answer"));

  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    text: "my answer",
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("prompts opencode when no pending prompt", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 42 }).run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.status.mockResolvedValue({
    data: { s1: { type: "idle" } },
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello"));

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("creates new session when none exists", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.status.mockResolvedValue({
    data: { s1: { type: "idle" } },
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello"));

  expect(opencodeClient.session.create).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("sends busy message when session is busy", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 42 }).run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.status.mockResolvedValue({
    data: { s1: { type: "busy" } },
  });
  const spy = vi
    .spyOn(grammySendBusyModule, "grammySendBusy")
    .mockResolvedValue(undefined);
  const bot = {} as never;
  const services = {
    bot,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello"));

  expect(spy).toHaveBeenCalledWith({
    bot,
    chatId: 42,
    threadId: undefined,
    ignoreErrors: false,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("sends busy message when session is retrying", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 42 }).run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.status.mockResolvedValue({
    data: { s1: { type: "retry", attempt: 1, message: "err", next: 1000 } },
  });
  const spy = vi
    .spyOn(grammySendBusyModule, "grammySendBusy")
    .mockResolvedValue(undefined);
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello"));

  expect(spy).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("passes threadId through the flow", async () => {
  using database = createDatabase(":memory:");
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 42, threadId: 7 })
    .run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.status.mockResolvedValue({
    data: { s1: { type: "idle" } },
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello", 7));

  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    text: "hello",
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("rethrows non-PendingPromptNotFoundError from answer", async () => {
  using database = createDatabase(":memory:");
  database.insert(schema.session).values({ id: "s1", chatId: 42 }).run();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await expect(grammyHandleText(services, mockCtx(42, "hello"))).rejects.toBe(
    error,
  );
});

test("prompts when session status is undefined (new session)", async () => {
  using database = createDatabase(":memory:");
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPromptNotFoundError());
  opencodeClient.session.create.mockResolvedValue({ data: { id: "s1" } });
  opencodeClient.session.status.mockResolvedValue({ data: {} });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const services = {
    bot: {} as never,
    database,
    opencodeClient: opencodeClient as never,
    pendingPrompts: pendingPrompts as never,
  } satisfies GrammyHandleContext;

  await grammyHandleText(services, mockCtx(42, "hello"));

  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});
