import { expect, test, vi } from "vitest";
import type { CommandRegistry } from "~/lib/command-registry";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleCustomCommand } from "~/lib/grammy-handle-custom-command";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent", () => ({
  getSessionAgent: vi.fn(() => undefined),
}));

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
}): Scope {
  return {
    bot: { api: { sendMessage: vi.fn() } } as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: {
      session: { promptAsync: vi.fn(async () => ({})) },
    } as never,
    commandRegistry: {} as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions(),
    workingSessions: (overrides.workingSessions ??
      mockWorkingSessions()) as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    attachmentStorage: {} as never,
    typingIndicators: {} as never,
  };
}

function mockExistingSessions(sessionId = "s1") {
  return {
    find: vi.fn(async () => sessionId),
  } as never as ExistingSessions;
}

function mockWorkingSessions() {
  return {
    lock: vi.fn((_id: string, fn: () => Promise<void>) => fn()),
  };
}

const signal = new AbortController().signal;

function makeCtx(text: string, threadId?: number) {
  return {
    chat: { id: 42 },
    msg: { message_thread_id: threadId },
    message: { message_id: 100, text },
  };
}

function makeCommand(
  overrides: Partial<CommandRegistry.Command> = {},
): CommandRegistry.Command {
  return {
    name: overrides.name ?? "translate",
    description: overrides.description ?? "Translate text",
    prompt: overrides.prompt ?? "Translate to English: {text}",
  };
}

test("expands {text} placeholder and sends prompt", async () => {
  const scope = mockScope({});
  const command = makeCommand();
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/translate hello world") as never,
    signal,
    command,
    "hello world",
  );
  expect(scope.opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "Translate to English: hello world" }],
    }),
    { throwOnError: true },
  );
});

test("sends usage hint when {text} required but args empty", async () => {
  const scope = mockScope({});
  const command = makeCommand();
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/translate") as never,
    signal,
    command,
    "",
  );
  expect(scope.bot.api.sendMessage).toHaveBeenCalledWith(
    42,
    "Usage: /translate <text>",
    expect.objectContaining({
      reply_parameters: { message_id: 100 },
    }),
  );
  expect(scope.opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("sends fixed prompt when no {text} in template", async () => {
  const scope = mockScope({});
  const command = makeCommand({ prompt: "Give me a daily summary" });
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/daily") as never,
    signal,
    command,
    "",
  );
  expect(scope.opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "Give me a daily summary" }],
    }),
    { throwOnError: true },
  );
});

test("ignores extra args when no {text} in template", async () => {
  const scope = mockScope({});
  const command = makeCommand({ prompt: "Give me a daily summary" });
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/daily extra stuff") as never,
    signal,
    command,
    "extra stuff",
  );
  expect(scope.opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "Give me a daily summary" }],
    }),
    { throwOnError: true },
  );
});

test("creates session for chat and thread", async () => {
  const existingSessions = mockExistingSessions();
  const scope = mockScope({ existingSessions });
  const command = makeCommand({ prompt: "Fixed prompt" });
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/cmd", 99) as never,
    signal,
    command,
    "",
  );
  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 99 },
    { createIfNotFound: true },
  );
});

test("sends session pending on LockedError", async () => {
  const ws = mockWorkingSessions();
  ws.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = mockScope({ workingSessions: ws });
  const command = makeCommand({ prompt: "Fixed" });
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/cmd") as never,
    signal,
    command,
    "",
  );
  expect(scope.opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("rethrows non-LockedError", async () => {
  const ws = mockWorkingSessions();
  ws.lock.mockRejectedValue(new Error("unexpected"));
  const scope = mockScope({ workingSessions: ws });
  const command = makeCommand({ prompt: "Fixed" });
  await expect(
    grammyHandleCustomCommand(
      scope,
      makeCtx("/cmd") as never,
      signal,
      command,
      "",
    ),
  ).rejects.toThrow("unexpected");
});

test("passes session agent to promptAsync", async () => {
  const scope = mockScope({});
  const { getSessionAgent } = await import("~/lib/get-session-agent");
  vi.mocked(getSessionAgent).mockReturnValueOnce("build");
  const command = makeCommand({ prompt: "Build it" });
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/build") as never,
    signal,
    command,
    "",
  );
  expect(scope.opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "build" }),
    { throwOnError: true },
  );
});

test("includes thread_id in usage hint reply", async () => {
  const scope = mockScope({});
  const command = makeCommand();
  await grammyHandleCustomCommand(
    scope,
    makeCtx("/translate", 55) as never,
    signal,
    command,
    "",
  );
  expect(scope.bot.api.sendMessage).toHaveBeenCalledWith(
    42,
    "Usage: /translate <text>",
    expect.objectContaining({ message_thread_id: 55 }),
  );
});
