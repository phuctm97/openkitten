import type { Event, GlobalEvent } from "@opencode-ai/sdk/v2";
import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import * as grammySendErrorModule from "~/lib/grammy-send-error";
import * as grammySendSessionCompactedModule from "~/lib/grammy-send-session-compacted";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import type { Scope } from "~/lib/scope";

vi.mock("~/lib/grammy-send-error");
vi.mock("~/lib/grammy-send-session-compacted");

function mockScope() {
  const bot = {} as never;
  const existingSessions = {
    getAvailable: vi.fn(
      (_sessionId: string): ExistingSessions.Location | undefined => ({
        chatId: 123,
        threadId: 456,
      }),
    ),
    get: vi.fn(
      (
        _sessionId: string,
        _options?: ExistingSessions.GetOptions,
      ): ExistingSessions.Location | undefined => ({
        chatId: 123,
        threadId: 456,
      }),
    ),
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

function wrap(payload: Event, directory = "/tmp/a"): GlobalEvent {
  return { directory, payload };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("updates working sessions on session.status event", async () => {
  const { scope, workingSessions } = mockScope();
  const payload = {
    type: "session.status" as const,
    properties: { sessionID: "s1", status: { type: "busy" as const } },
  };
  await opencodeHandleEvent(scope, wrap(payload), new AbortController().signal);
  expect(workingSessions.update).toHaveBeenCalledWith(payload);
});

test("updates pending prompts on question.asked event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const payload = {
    type: "question.asked" as const,
    properties: { id: "q1", sessionID: "s1", questions: [] },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(payload);
});

test("updates pending prompts on permission.asked event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const payload = {
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
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(payload);
});

test("processes message on message.updated event", async () => {
  const { scope, processingMessages } = mockScope();
  const payload = {
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
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(payload);
});

test("processes message on message.removed event", async () => {
  const { scope, processingMessages } = mockScope();
  const payload = {
    type: "message.removed" as const,
    properties: {
      sessionID: "s1",
      messageID: "m1",
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(payload);
});

test("processes message on message.part.updated event", async () => {
  const { scope, processingMessages } = mockScope();
  const payload = {
    type: "message.part.updated" as const,
    properties: {
      sessionID: "s1",
      part: {
        id: "p1",
        sessionID: "s1",
        messageID: "m1",
        type: "text" as const,
        text: "hello",
      },
      time: 1,
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(payload);
});

test("processes message on message.part.removed event", async () => {
  const { scope, processingMessages } = mockScope();
  const payload = {
    type: "message.part.removed" as const,
    properties: {
      sessionID: "s1",
      messageID: "m1",
      partID: "p1",
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(payload);
});

test("processes message on message.part.delta event", async () => {
  const { scope, processingMessages } = mockScope();
  const payload = {
    type: "message.part.delta" as const,
    properties: {
      sessionID: "s1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: "hello",
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(processingMessages.update).toHaveBeenCalledWith(payload);
});

test("sends error on session.error", async () => {
  const { scope, bot } = mockScope();
  const error = { type: "unknown_error" as const, message: "boom" };
  await opencodeHandleEvent(
    scope,
    wrap({
      type: "session.error" as const,
      properties: { sessionID: "s1", error },
    } as never),
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
    wrap(
      {
        type: "session.error" as const,
        properties: {},
      } as never,
      "global",
    ),
    new AbortController().signal,
  );
  expect(grammySendErrorModule.grammySendError).not.toHaveBeenCalled();
});

test("ignores session.error for removed session", async () => {
  const { scope, existingSessions } = mockScope();
  existingSessions.getAvailable.mockReturnValue(undefined);
  await opencodeHandleEvent(
    scope,
    wrap({
      type: "session.error" as const,
      properties: {
        sessionID: "s1",
        error: { type: "unknown_error" as const, message: "boom" },
      },
    } as never),
    new AbortController().signal,
  );
  expect(grammySendErrorModule.grammySendError).not.toHaveBeenCalled();
});

test("sends compacted on session.compacted", async () => {
  const { scope, bot } = mockScope();
  await opencodeHandleEvent(
    scope,
    wrap({
      type: "session.compacted" as const,
      properties: { sessionID: "s1" },
    } as never),
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

test("ignores session.compacted for removed session", async () => {
  const { scope, existingSessions } = mockScope();
  existingSessions.getAvailable.mockReturnValue(undefined);
  await opencodeHandleEvent(
    scope,
    wrap({
      type: "session.compacted" as const,
      properties: { sessionID: "s1" },
    } as never),
    new AbortController().signal,
  );
  expect(
    grammySendSessionCompactedModule.grammySendSessionCompacted,
  ).not.toHaveBeenCalled();
});

test("updates pending prompts on permission.replied event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const payload = {
    type: "permission.replied" as const,
    properties: {
      sessionID: "s1",
      requestID: "p1",
      reply: "once" as const,
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(payload);
});

test("updates pending prompts on question.replied event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const payload = {
    type: "question.replied" as const,
    properties: {
      sessionID: "s1",
      requestID: "q1",
      answers: [["option1"]],
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(payload);
});

test("updates pending prompts on question.rejected event", async () => {
  const { scope, pendingPrompts } = mockScope();
  const payload = {
    type: "question.rejected" as const,
    properties: {
      sessionID: "s1",
      requestID: "q1",
    },
  };
  await opencodeHandleEvent(
    scope,
    wrap(payload as never),
    new AbortController().signal,
  );
  expect(pendingPrompts.update).toHaveBeenCalledWith(payload);
});

test("ignores unrelated event types", async () => {
  const { scope, workingSessions, pendingPrompts, processingMessages } =
    mockScope();
  await opencodeHandleEvent(
    scope,
    wrap({ type: "session.created" } as never),
    new AbortController().signal,
  );
  expect(workingSessions.update).not.toHaveBeenCalled();
  expect(pendingPrompts.update).not.toHaveBeenCalled();
  expect(processingMessages.update).not.toHaveBeenCalled();
});
