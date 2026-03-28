import { beforeEach, expect, test, vi } from "vitest";
import * as grammySendErrorModule from "~/lib/grammy-send-error";
import * as grammySendSessionCompactedModule from "~/lib/grammy-send-session-compacted";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import type { Scope } from "~/lib/scope";

vi.mock("~/lib/grammy-send-error");
vi.mock("~/lib/grammy-send-session-compacted");

function mockScope() {
  const bot = {} as never;
  const existingSessions = {
    resolve: vi.fn().mockReturnValue({ chatId: 123, threadId: 456 }),
  };
  const workingSessions = { update: vi.fn() };
  const pendingPrompts = { update: vi.fn() };
  const processingMessages = { update: vi.fn() };
  return {
    scope: {
      bot,
      existingSessions,
      workingSessions,
      pendingPrompts,
      processingMessages,
    } as unknown as Scope,
    bot,
    existingSessions,
    workingSessions,
    pendingPrompts,
    processingMessages,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("updates working sessions on session.status event", async () => {
  const { scope, workingSessions } = mockScope();
  const event = {
    type: "session.status" as const,
    properties: { sessionID: "s1", status: { type: "busy" as const } },
  };
  await opencodeHandleEvent(scope, event, new AbortController().signal);
  expect(workingSessions.update).toHaveBeenCalledWith(event);
});

test("updates pending prompts on question.asked event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const event = {
    type: "question.asked" as const,
    properties: { id: "q1", sessionID: "s1", questions: [] },
  };
  await opencodeHandleEvent(
    scope,
    event as never,
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(event);
});

test("updates pending prompts on permission.asked event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const event = {
    type: "permission.asked" as const,
    properties: {
      id: "p1",
      sessionID: "s1",
      permission: "bash",
      patterns: [],
      metadata: {},
      always: [],
    },
  };
  await opencodeHandleEvent(
    scope,
    event as never,
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(event);
});

test("processes message on message.updated event", async () => {
  const { scope, processingMessages } = mockScope();
  const event = {
    type: "message.updated" as const,
    properties: {
      info: {
        id: "m1",
        sessionID: "s1",
        role: "assistant" as const,
        time: { created: 1, completed: 2 },
      },
    },
  };
  await opencodeHandleEvent(
    scope,
    event as never,
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(event);
});

test("sends error on session.error", async () => {
  const { scope, bot } = mockScope();
  const error = { type: "unknown_error" as const, message: "boom" };
  await opencodeHandleEvent(
    scope,
    {
      type: "session.error" as const,
      properties: { sessionID: "s1", error },
    } as never,
    new AbortController().signal,
  );
  expect(grammySendErrorModule.grammySendError).toHaveBeenCalledWith({
    bot,
    error,
    chatId: 123,
    threadId: 456,
  });
});

test("ignores session.error without sessionID", async () => {
  const { scope } = mockScope();
  await opencodeHandleEvent(
    scope,
    {
      type: "session.error" as const,
      properties: {},
    } as never,
    new AbortController().signal,
  );
  expect(grammySendErrorModule.grammySendError).not.toHaveBeenCalled();
});

test("sends session compacted on session.compacted", async () => {
  const { scope, bot } = mockScope();
  await opencodeHandleEvent(
    scope,
    {
      type: "session.compacted" as const,
      properties: { sessionID: "s1" },
    } as never,
    new AbortController().signal,
  );
  expect(
    grammySendSessionCompactedModule.grammySendSessionCompacted,
  ).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: 456,
  });
});

test("updates pending prompts on permission.replied event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const event = {
    type: "permission.replied" as const,
    properties: {
      sessionID: "s1",
      requestID: "p1",
      reply: "once" as const,
    },
  };
  await opencodeHandleEvent(scope, event, new AbortController().signal);
  expect(pendingPrompts.update).toHaveBeenCalledWith(event);
});

test("updates pending prompts on question.replied event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const event = {
    type: "question.replied" as const,
    properties: {
      sessionID: "s1",
      requestID: "q1",
      answers: [["option1"]],
    },
  };
  await opencodeHandleEvent(
    scope,
    event as never,
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(event);
});

test("updates pending prompts on question.rejected event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const event = {
    type: "question.rejected" as const,
    properties: {
      sessionID: "s1",
      requestID: "q1",
    },
  };
  await opencodeHandleEvent(scope, event, new AbortController().signal);
  expect(pendingPrompts.update).toHaveBeenCalledWith(event);
});

test("ignores unrelated event types", async () => {
  const { scope, workingSessions, pendingPrompts, processingMessages } =
    mockScope();
  await opencodeHandleEvent(
    scope,
    { type: "session.created" } as never,
    new AbortController().signal,
  );
  expect(workingSessions.update).not.toHaveBeenCalled();
  expect(pendingPrompts.update).not.toHaveBeenCalled();
  expect(processingMessages.update).not.toHaveBeenCalled();
});
