import { beforeEach, expect, test, vi } from "vitest";
import { opencodeHandleEvent } from "~/lib/opencode-handle-event";
import type { Scope } from "~/lib/scope";

function mockScope() {
  const workingSessions = { update: vi.fn() };
  const pendingPrompts = { update: vi.fn() };
  const processingMessages = { update: vi.fn() };
  return {
    scope: {
      workingSessions,
      pendingPrompts,
      processingMessages,
    } as unknown as Scope,
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
