import { eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { ProcessingMessages } from "~/lib/processing-messages";
import * as schema from "~/lib/schema";

vi.mock("~/lib/grammy-send-message", () => ({
  grammySendMessage: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSessionMessage: MockFn;
let mockSessionMessages: MockFn;

function createMockOpencodeClient() {
  mockSessionMessage = vi.fn(async () => ({
    data: { info: {}, parts: [{ type: "text", text: "hello world" }] },
  }));
  mockSessionMessages = vi.fn(async () => ({ data: [] }));
  return {
    session: {
      message: (...args: unknown[]) => mockSessionMessage(...args),
      messages: (...args: unknown[]) => mockSessionMessages(...args),
    },
  } as never;
}

function createMockExistingSessions(
  sessionIds: readonly string[] = ["sess-1"],
) {
  return {
    sessionIds,
    resolve: vi.fn(() => ({ chatId: 123, threadId: undefined })),
  } as unknown as ExistingSessions;
}

function setup() {
  const database = Database.create(":memory:");
  database
    .insert(schema.session)
    .values({ id: "sess-1", chatId: 123, threadId: 0 })
    .run();
  const bot = {} as never;
  const client = createMockOpencodeClient();
  const es = createMockExistingSessions();
  const pm = ProcessingMessages.create(bot, database, client, es);
  return { database, bot, client, es, pm };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- update tests ---

test("update delivers completed assistant message", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { bot, pm } = setup();
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
  expect(grammySendMessage).toHaveBeenCalledWith({
    bot,
    text: "hello world",
    chatId: 123,
    threadId: undefined,
  });
});

test("update skips incomplete assistant message", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { pm } = setup();
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
  expect(grammySendMessage).not.toHaveBeenCalled();
});

test("update skips user message", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { pm } = setup();
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
  expect(grammySendMessage).not.toHaveBeenCalled();
});

test("update skips already processed message", async () => {
  const { pm } = setup();
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

test("update skips message with no text parts", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { pm } = setup();
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
  expect(grammySendMessage).not.toHaveBeenCalled();
});

test("update persists message to database", async () => {
  const { database, pm } = setup();
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

// --- invalidate tests ---

test("invalidate delivers new messages not in database", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { pm } = setup();
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
  await pm.invalidate();
  expect(grammySendMessage).toHaveBeenCalled();
});

test("invalidate skips messages already in database", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { database, pm } = setup();
  database
    .insert(schema.message)
    .values({ id: "m1", sessionId: "sess-1" })
    .run();
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
  await pm.invalidate();
  expect(grammySendMessage).not.toHaveBeenCalled();
});

test("invalidate stops expanding when oldest message is already in database", async () => {
  const { database, pm } = setup();
  database
    .insert(schema.message)
    .values({ id: "m0", sessionId: "sess-1" })
    .run();
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
  await pm.invalidate();
  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
});

test("invalidate doubles limit when no overlap found", async () => {
  const { pm } = setup();
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
  await pm.invalidate();
  expect(mockSessionMessages).toHaveBeenCalledTimes(2);
});

test("invalidate keeps expanding when batch has no assistant messages", async () => {
  const { pm } = setup();
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
  await pm.invalidate();
  expect(mockSessionMessages).toHaveBeenCalledTimes(2);
});

test("invalidate stops when batch is smaller than limit", async () => {
  const { pm } = setup();
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
  await pm.invalidate();
  expect(mockSessionMessages).toHaveBeenCalledTimes(1);
});

test("invalidate skips user messages", async () => {
  const { grammySendMessage } = await import("~/lib/grammy-send-message");
  const { pm } = setup();
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
  await pm.invalidate();
  expect(grammySendMessage).not.toHaveBeenCalled();
});

test("invalidate with no sessions skips processing", async () => {
  const database = Database.create(":memory:");
  const bot = {} as never;
  const client = createMockOpencodeClient();
  const es = createMockExistingSessions([]);
  const pm = ProcessingMessages.create(bot, database, client, es);
  await pm.invalidate();
  expect(mockSessionMessages).not.toHaveBeenCalled();
});

test("update unclaims on delivery failure and allows retry", async () => {
  const { database, pm } = setup();
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

test("invalidate unclaims on delivery failure and allows retry", async () => {
  const { database, pm } = setup();
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
  const mod = await import("~/lib/grammy-send-message");
  vi.mocked(mod.grammySendMessage).mockRejectedValueOnce(
    new Error("delivery failed"),
  );
  await expect(pm.invalidate()).rejects.toThrow();
  const row = database.query.message
    .findFirst({ where: eq(schema.message.id, "m1") })
    .sync();
  expect(row).toBeUndefined();
});

test("update after invalidate deduplicates via database", async () => {
  const { pm } = setup();
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
  await pm.invalidate();
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
