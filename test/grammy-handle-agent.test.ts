import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleAgent } from "~/lib/grammy-handle-agent";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import { grammySendAgentList } from "~/lib/grammy-send-agent-list";
import { grammySendAgentNotFound } from "~/lib/grammy-send-agent-not-found";
import type { Scope } from "~/lib/scope";
import { setSessionAgent } from "~/lib/set-session-agent";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-agent-changed");
vi.mock("~/lib/grammy-send-agent-list");
vi.mock("~/lib/grammy-send-agent-not-found");
vi.mock("~/lib/set-session-agent");

beforeEach(() => {
  vi.clearAllMocks();
});

function mockCtx(chatId: number, match: string, threadId?: number) {
  const react = vi.fn(async () => true);
  return {
    ctx: {
      chat: { id: chatId },
      msg: { message_id: 99, message_thread_id: threadId },
      match,
      update: { update_id: 1 },
      react,
    } as never,
    react,
  };
}

function mockExistingSessions(): ExistingSessions {
  return {
    sessionIds: ["s1"],
    find: vi.fn(
      (
        _location: ExistingSessions.Location,
        options?: ExistingSessions.FindOptions,
      ) => {
        if (options?.createIfNotFound) return Promise.resolve("s1");
        return "s1";
      },
    ),
    invalidate: vi.fn(),
    check: vi.fn(() => true),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 42,
      threadId: undefined,
    })),
  } as never;
}

const agents = [
  { name: "assist", mode: "primary", description: "General purpose" },
  { name: "build", mode: "all", description: "Software engineering" },
  { name: "plan", mode: "primary" },
  { name: "sub-task", mode: "subagent", description: "Internal" },
];

const availableAgents = agents.filter((a) => a.mode !== "subagent");

function mockOpencodeClient(defaultAgent?: string) {
  return {
    app: {
      agents: vi.fn(async () => ({ data: agents })),
    },
    config: {
      get: vi.fn(async () => ({
        data: { default_agent: defaultAgent },
      })),
    },
  };
}

function mockScope(overrides: {
  existingSessions: ExistingSessions;
  opencodeClient: ReturnType<typeof mockOpencodeClient>;
}): Scope {
  return {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: overrides.opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions: overrides.existingSessions,
    workingSessions: {} as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  };
}

test("shows current agent and available agents when no argument", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx);

  expect(grammySendAgentList).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    currentAgent: "build",
    availableAgents,
  });
});

test("shows configured default agent when none is set", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient("assist");
  vi.mocked(getSessionAgent).mockReturnValue(undefined);
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx);

  expect(grammySendAgentList).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    currentAgent: "assist",
    availableAgents,
  });
});

test("falls back to build when default_agent is not configured", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  vi.mocked(getSessionAgent).mockReturnValue(undefined);
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx);

  expect(grammySendAgentList).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    currentAgent: "build",
    availableAgents,
  });
});

test("sets valid agent and replies with agent changed", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx, react } = mockCtx(42, "build");

  await grammyHandleAgent(scope, ctx);

  expect(setSessionAgent).toHaveBeenCalledWith(scope.database, "s1", "build");
  expect(react).not.toHaveBeenCalled();
  expect(grammySendAgentChanged).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    agent: agents[1],
  });
});

test("replies with not found for unknown agent", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "nonexistent");

  await grammyHandleAgent(scope, ctx);

  expect(setSessionAgent).not.toHaveBeenCalled();
  expect(grammySendAgentNotFound).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    name: "nonexistent",
  });
});

test("rejects subagent", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "sub-task");

  await grammyHandleAgent(scope, ctx);

  expect(setSessionAgent).not.toHaveBeenCalled();
  expect(grammySendAgentNotFound).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    name: "sub-task",
  });
});

test("passes threadId when present", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "build", 7);

  await grammyHandleAgent(scope, ctx);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(grammySendAgentChanged).toHaveBeenCalledWith(
    expect.objectContaining({ threadId: 7 }),
  );
});
