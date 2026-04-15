import { eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { GroupMessageBuffer } from "~/lib/group-message-buffer";
import { ProcessingMessages } from "~/lib/processing-messages";
import * as schema from "~/lib/schema";

vi.mock("~/lib/grammy-send-assistant-message", () => ({
  grammySendAssistantMessage: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSessionMessage: MockFn;
let mockSessionMessages: MockFn;

function createMockOpencodeClient(
  options: { preserveMessagesMock?: boolean } = {},
) {
  mockSessionMessage = vi.fn(async () => ({
    data: { info: {}, parts: [{ type: "text", text: "hello world" }] },
  }));
  if (!options.preserveMessagesMock) {
    mockSessionMessages = vi.fn(async () => ({ data: [] }));
  }
  return {
    session: {
      message: (...args: unknown[]) => mockSessionMessage(...args),
      messages: (...args: unknown[]) => mockSessionMessages(...args),
    },
  } as never;
}

function createMockExistingSessions(sessionIds: readonly string[] = []) {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    sessionIds: [...sessionIds],
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    check: vi.fn(() => true),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 123,
      threadId: undefined,
    })),
    hooks,
  } as unknown as ExistingSessions & {
    hooks: typeof hooks;
    sessionIds: string[];
  };
}

async function setup(
  sessionIds: readonly string[] = [],
  options: {
    preserveMessagesMock?: boolean;
    persistedMessageIds?: readonly string[];
  } = {},
) {
  const database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  if (options.persistedMessageIds) {
    database
      .insert(schema.message)
      .values(
        options.persistedMessageIds.map((id) => ({
          id,
          sessionId: "sess-1",
        })),
      )
      .run();
  }
  const bot = {} as never;
  const client = createMockOpencodeClient(options);
  const es = createMockExistingSessions(sessionIds);
  const pm = await ProcessingMessages.create(bot, database, client, es);
  return { database, bot, client, es, pm };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- update tests ---

test("update delivers completed assistant message", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { bot, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  expect(mockSessionMessage).toHaveBeenCalledWith(
    { sessionID: "sess-1", messageID: "m1" },
    { throwOnError: true },
  );
  expect(grammySendAssistantMessage).toHaveBeenCalledWith({
    bot,
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1, completed: 2 },
    },
    parts: [{ type: "text", text: "hello world" }],
    chatId: 123,
    threadId: undefined,
  });
});

test("update clears the streaming message once it completes", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  expect(pm.streaming("sess-1")).toBeDefined();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("update skips incomplete assistant message", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  expect(mockSessionMessage).not.toHaveBeenCalled();
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
});

test("update stores incomplete assistant message as latest streaming state", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [],
  });
});

test("update refreshes streaming message info without dropping parts", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [
      {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
    ],
  });
});

test("update ignores part snapshots without an active streaming message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 1,
    },
  } as never);
  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("update ignores part snapshots for removed sessions", async () => {
  const { es, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  vi.mocked(es.check).mockReturnValue(false);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 1,
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([]);
});

test("update replaces an existing part snapshot", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "world",
      },
      time: 3,
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "world",
    },
  ]);
});

test("update stores latest parts for the streaming assistant message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p2",
        sessionID: "sess-1",
        messageID: "m1",
        type: "tool",
        callID: "call-1",
        tool: "bash",
        state: {
          status: "pending",
          input: {},
          raw: "echo hello",
        },
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 3,
    },
  } as never);
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [
      {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      {
        id: "p2",
        sessionID: "sess-1",
        messageID: "m1",
        type: "tool",
        callID: "call-1",
        tool: "bash",
        state: {
          status: "pending",
          input: {},
          raw: "echo hello",
        },
      },
    ],
  });
});

test("update appends deltas onto text parts in streaming state", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hel",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: "lo",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "hello",
    },
  ]);
});

test("update appends deltas onto reasoning parts in streaming state", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "reasoning",
        text: "think",
        time: { start: 2 },
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: "ing",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "reasoning",
      text: "thinking",
      time: { start: 2 },
    },
  ]);
});

test("update ignores deltas for unsupported fields", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "metadata",
      delta: "ignored",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "hello",
    },
  ]);
});

test("update ignores deltas for missing parts", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: "ignored",
    },
  } as never);
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [],
  });
});

test("update ignores deltas for a different message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m2",
      partID: "p1",
      field: "text",
      delta: "ignored",
    },
  } as never);
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [],
  });
});

test("update ignores part deltas for removed sessions", async () => {
  const { es, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  vi.mocked(es.check).mockReturnValue(false);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: " world",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "hello",
    },
  ]);
});

test("update ignores text deltas for non-text parts", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "tool",
        callID: "call-1",
        tool: "bash",
        state: {
          status: "pending",
          input: {},
          raw: "echo hello",
        },
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.delta",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
      field: "text",
      delta: "ignored",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "tool",
      callID: "call-1",
      tool: "bash",
      state: {
        status: "pending",
        input: {},
        raw: "echo hello",
      },
    },
  ]);
});

test("update removes parts from the latest streaming message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.removed",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([]);
});

test("update ignores part removals for a different message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  await pm.update({
    type: "message.part.removed",
    properties: {
      sessionID: "sess-1",
      messageID: "m2",
      partID: "p1",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "hello",
    },
  ]);
});

test("update ignores part removals for removed sessions", async () => {
  const { es, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.part.updated",
    properties: {
      sessionID: "sess-1",
      part: {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "hello",
      },
      time: 2,
    },
  } as never);
  vi.mocked(es.check).mockReturnValue(false);
  await pm.update({
    type: "message.part.removed",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
      partID: "p1",
    },
  } as never);
  expect(pm.streaming("sess-1")?.parts).toEqual([
    {
      id: "p1",
      sessionID: "sess-1",
      messageID: "m1",
      type: "text",
      text: "hello",
    },
  ]);
});

test("update removes the latest streaming message", async () => {
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  await pm.update({
    type: "message.removed",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
    },
  } as never);
  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("update ignores message.removed for removed sessions", async () => {
  const { es, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  vi.mocked(es.check).mockReturnValue(false);
  await pm.update({
    type: "message.removed",
    properties: {
      sessionID: "sess-1",
      messageID: "m1",
    },
  } as never);
  expect(pm.streaming("sess-1")?.info.id).toBe("m1");
});

test("beforeRemove clears streaming state", async () => {
  const { es, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  } as never);
  expect(pm.streaming("sess-1")).toBeDefined();

  es.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });

  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("update skips user message", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "user",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  expect(mockSessionMessage).not.toHaveBeenCalled();
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
});

test("update skips already processed message", async () => {
  const { pm } = await setup();
  const event = {
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never;
  await pm.update(event);
  mockSessionMessage.mockClear();
  await pm.update(event);
  expect(mockSessionMessage).not.toHaveBeenCalled();
});

test("update forwards message with no text parts to the assistant sender", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { bot, pm } = await setup();
  mockSessionMessage = vi.fn(async () => ({
    data: { info: {}, parts: [{ type: "tool", name: "bash" }] as never },
  }));
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  expect(grammySendAssistantMessage).toHaveBeenCalledWith({
    bot,
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1, completed: 2 },
    },
    parts: [{ type: "tool", name: "bash" }],
    chatId: 123,
    threadId: undefined,
  });
});

test("update persists message to database", async () => {
  const { database, pm } = await setup();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeDefined();
  expect(row?.sessionId).toBe("sess-1");
});

// --- initialized tests ---

test("initialized syncs persisted messages on startup", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [{ type: "text", text: "hello" }],
      },
    ],
  }));
  const { bot } = await setup(["sess-1"], { preserveMessagesMock: true });
  expect(grammySendAssistantMessage).toHaveBeenCalledWith({
    bot,
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 1, completed: 2 },
    },
    parts: [{ type: "text", text: "hello" }],
    chatId: 123,
    threadId: undefined,
  });
});

test("initialized seeds the latest assistant streaming state", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m0",
          sessionID: "sess-1",
          role: "user",
          time: { created: 1 },
        },
        parts: [],
      },
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [
          {
            id: "p1",
            sessionID: "sess-1",
            messageID: "m1",
            type: "text",
            text: "streaming",
          },
        ],
      },
    ],
  }));
  const { pm } = await setup(["sess-1"], { preserveMessagesMock: true });
  expect(pm.streaming("sess-1")).toEqual({
    info: {
      id: "m1",
      sessionID: "sess-1",
      role: "assistant",
      time: { created: 2 },
    },
    parts: [
      {
        id: "p1",
        sessionID: "sess-1",
        messageID: "m1",
        type: "text",
        text: "streaming",
      },
    ],
  });
});

test("initialized picks the newest streaming assistant message by creation time", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1 },
        },
        parts: [],
      },
      {
        info: {
          id: "m2",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [],
      },
    ],
  }));
  const { pm } = await setup(["sess-1"], { preserveMessagesMock: true });
  expect(pm.streaming("sess-1")?.info.id).toBe("m2");
});

test("initialized keeps the newer streaming message when a later candidate is older", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m2",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [],
      },
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1 },
        },
        parts: [],
      },
    ],
  }));
  const { pm } = await setup(["sess-1"], { preserveMessagesMock: true });
  expect(pm.streaming("sess-1")?.info.id).toBe("m2");
});

test("initialized breaks streaming-message ties by higher message id", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m2",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [],
      },
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [],
      },
      {
        info: {
          id: "m3",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 2 },
        },
        parts: [],
      },
    ],
  }));
  const { pm } = await setup(["sess-1"], { preserveMessagesMock: true });
  expect(pm.streaming("sess-1")?.info.id).toBe("m3");
});

test("initialized skips messages already in database", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [{ type: "text", text: "hello" }],
      },
    ],
  }));
  await setup(["sess-1"], {
    preserveMessagesMock: true,
    persistedMessageIds: ["m1"],
  });
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
});

test("initialized stops expanding when oldest message is already in database", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: Array.from({ length: 10 }, (_, i) => ({
      info: {
        id: `m${i}`,
        sessionID: "sess-1",
        role: "assistant",
        time: { created: i, completed: i + 1 },
      },
      parts: [],
    })),
  }));
  await setup(["sess-1"], {
    preserveMessagesMock: true,
    persistedMessageIds: ["m0"],
  });
  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
});

test("initialized doubles limit when no overlap is found", async () => {
  let callCount = 0;
  mockSessionMessages = vi.fn(async (...args: unknown[]) => {
    const { limit } = args[0] as { limit: number };
    callCount++;
    if (callCount === 1) {
      expect(limit).toBe(10);
      return {
        data: Array.from({ length: 10 }, (_, i) => ({
          info: {
            id: `m${i}`,
            sessionID: "sess-1",
            role: "assistant",
            time: { created: i, completed: i + 1 },
          },
          parts: [],
        })),
      };
    }
    expect(limit).toBe(20);
    return { data: [] };
  });
  await setup(["sess-1"], { preserveMessagesMock: true });
  expect(mockSessionMessages).toHaveBeenCalledTimes(2);
});

test("initialized keeps expanding when the batch has no assistant messages", async () => {
  let callCount = 0;
  mockSessionMessages = vi.fn(async () => {
    callCount++;
    if (callCount === 1) {
      return {
        data: Array.from({ length: 10 }, (_, i) => ({
          info: {
            id: `m${i}`,
            sessionID: "sess-1",
            role: "user",
            time: { created: i },
          },
          parts: [],
        })),
      };
    }
    return { data: [] };
  });
  await setup(["sess-1"], { preserveMessagesMock: true });
  expect(mockSessionMessages).toHaveBeenCalledTimes(2);
});

test("initialized stops when the batch is smaller than the limit", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [],
      },
    ],
  }));
  await setup(["sess-1"], { preserveMessagesMock: true });
  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
});

test("initialized skips user messages", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "user",
          time: { created: 1, completed: 2 },
        },
        parts: [],
      },
    ],
  }));
  await setup(["sess-1"], { preserveMessagesMock: true });
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
});

test("initialized with no sessions skips processing", async () => {
  const database = Database.create();
  const bot = {} as never;
  const client = createMockOpencodeClient();
  const es = createMockExistingSessions([]);
  await ProcessingMessages.create(bot, database, client, es);
  expect(mockSessionMessages).not.toHaveBeenCalled();
});

test("update skips removed sessions before processing", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { database, es, pm } = await setup();
  vi.mocked(es.check).mockReturnValue(false);

  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);

  expect(mockSessionMessage).not.toHaveBeenCalled();
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeUndefined();
});

test("update skips delivery when session disappears after claim", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  const { database, es, pm } = await setup();
  vi.mocked(es.get).mockReturnValue(undefined);

  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);

  expect(mockSessionMessage).toHaveBeenCalledWith(
    { sessionID: "sess-1", messageID: "m1" },
    { throwOnError: true },
  );
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeDefined();
});

test("initialized stops when session disappears after fetching messages", async () => {
  const { grammySendAssistantMessage } = await import(
    "~/lib/grammy-send-assistant-message"
  );
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [],
      },
    ],
  }));
  const database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  const bot = {} as never;
  const client = createMockOpencodeClient({ preserveMessagesMock: true });
  const es = createMockExistingSessions(["sess-1"]);
  vi.mocked(es.check).mockReturnValueOnce(true).mockReturnValue(false);

  const pm = await ProcessingMessages.create(bot, database, client, es);

  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
  expect(grammySendAssistantMessage).not.toHaveBeenCalled();
  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("initialized skips streaming state when session disappears before sync commits", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1 },
        },
        parts: [],
      },
    ],
  }));
  const database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  const bot = {} as never;
  const client = createMockOpencodeClient({ preserveMessagesMock: true });
  const es = createMockExistingSessions(["sess-1"]);
  vi.mocked(es.check).mockReturnValue(false);

  const pm = await ProcessingMessages.create(bot, database, client, es);

  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
  expect(pm.streaming("sess-1")).toBeUndefined();
});

test("dispose unhooks beforeRemove", async () => {
  const { es, pm } = await setup();
  pm[Symbol.dispose]();
  expect(es.hooks["beforeRemove"]).toBeUndefined();
});

test("update unclaims on delivery failure and allows retry", async () => {
  const { database, pm } = await setup();
  mockSessionMessage = vi.fn(async () => {
    throw new Error("delivery failed");
  });
  await expect(
    pm.update({
      type: "message.updated",
      properties: {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
      },
    } as never),
  ).rejects.toThrow("delivery failed");
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeUndefined();
});

test("initialized unclaims on delivery failure and allows retry", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [{ type: "text", text: "hello" }],
      },
    ],
  }));
  const mod = await import("~/lib/grammy-send-assistant-message");
  vi.mocked(mod.grammySendAssistantMessage).mockRejectedValueOnce(
    new Error("delivery failed"),
  );
  const database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  const bot = {} as never;
  const client = createMockOpencodeClient({ preserveMessagesMock: true });
  const es = createMockExistingSessions(["sess-1"]);
  await expect(
    ProcessingMessages.create(bot, database, client, es),
  ).rejects.toThrow();
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeUndefined();
});

test("update after initialized deduplicates via database", async () => {
  mockSessionMessages = vi.fn(async () => ({
    data: [
      {
        info: {
          id: "m1",
          sessionID: "sess-1",
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
        parts: [{ type: "text", text: "hello" }],
      },
    ],
  }));
  const { pm } = await setup(["sess-1"], { preserveMessagesMock: true });
  mockSessionMessage.mockClear();
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m1",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  expect(mockSessionMessage).not.toHaveBeenCalled();
});

test("delivers completed message and buffers in group mode", async () => {
  const database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  const bot = {} as never;
  const client = createMockOpencodeClient();
  const es = createMockExistingSessions([]);
  using buffer = GroupMessageBuffer.create();
  const pm = await ProcessingMessages.create(bot, database, client, es, buffer);
  await pm.update({
    type: "message.updated",
    properties: {
      info: {
        id: "m-group",
        sessionID: "sess-1",
        role: "assistant",
        time: { created: 1, completed: 2 },
      },
    },
  } as never);
  const recent = buffer.recent({ chatId: 123, threadId: undefined });
  expect(recent).toHaveLength(1);
  expect(recent[0]?.isBot).toBe(true);
  expect(recent[0]?.text).toBe("hello world");
});
