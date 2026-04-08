import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { Scheduler } from "~/lib/scheduler";

// Bun.cron.parse is not yet in @types/bun.
declare namespace Bun {
  namespace cron {
    function parse(expression: string, cursor?: Date): Date | null;
  }
}

const mockGetSessionAgent = vi.fn<() => string | undefined>();

vi.mock("~/lib/get-session-agent", () => ({
  getSessionAgent: () => mockGetSessionAgent(),
}));

let cronParseSpy: Mock<(expression: string, cursor?: Date) => Date | null>;
let database: Database;
let mockBot: {
  api: { sendMessage: ReturnType<typeof vi.fn> };
};
let opencodeClient: {
  session: {
    promptAsync: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    messages: ReturnType<typeof vi.fn>;
  };
};
let existingSessions: {
  find: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};
let scheduler: Scheduler;

beforeEach(async () => {
  vi.useFakeTimers();

  cronParseSpy = vi
    .spyOn(Bun.cron, "parse")
    .mockImplementation(() => new Date(Date.now() + 60_000));

  database = Database.create();
  mockBot = { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
  opencodeClient = {
    session: {
      promptAsync: vi.fn().mockResolvedValue({ data: undefined }),
      create: vi
        .fn()
        .mockResolvedValue({ data: { id: "ephemeral-session-1" } }),
      abort: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({ data: {} }),
      messages: vi.fn().mockResolvedValue({
        data: [
          {
            info: { role: "user" },
            parts: [],
          },
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "text",
                text: "[NO_REPORT]",
              },
            ],
          },
        ],
      }),
    },
  };
  existingSessions = {
    find: vi.fn().mockResolvedValue("session-1"),
    get: vi.fn().mockReturnValue({ chatId: 123, threadId: undefined }),
  };
  mockGetSessionAgent.mockReturnValue(undefined);

  const schema = await import("~/lib/schema");
  database
    .insert(schema.session)
    .values({ id: "session-1", chatId: 123, threadId: 0 })
    .run();

  scheduler = Scheduler.create(
    mockBot as never,
    database,
    opencodeClient as never,
    existingSessions as never,
  );
});

afterEach(() => {
  scheduler[Symbol.dispose]();
  database[Symbol.dispose]();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

test("create() inserts row and returns task with all fields", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "hourly",
    prompt: "do something",
    once: false,
  });

  expect(task.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(task.sessionId).toBe("session-1");
  expect(task.kind).toBe("session");
  expect(task.cron).toBe("0 * * * *");
  expect(task.description).toBe("hourly");
  expect(task.prompt).toBe("do something");
  expect(task.once).toBe(false);
  expect(task.nextRun).toBe(new Date(Date.now() + 60_000).toISOString());
});

test("create() with once=true", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "one-time",
    prompt: "run once",
    once: true,
  });

  expect(task.once).toBe(true);
});

test("create() with background kind", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "@daily",
    description: "bg task",
    prompt: "check status",
    once: false,
  });

  expect(task.kind).toBe("background");
});

test("create() returns null nextRun when Bun.cron.parse returns null", async () => {
  cronParseSpy.mockReturnValue(null);

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "invalid",
    description: "d",
    prompt: "p",
    once: false,
  });

  expect(task.nextRun).toBeNull();
});

test("create() returns null nextRun when Bun.cron.parse throws", async () => {
  cronParseSpy.mockImplementation(() => {
    throw new Error("bad cron");
  });

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "broken",
    description: "d",
    prompt: "p",
    once: false,
  });

  expect(task.nextRun).toBeNull();
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

test("list() returns all tasks with full data", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "Task A",
    prompt: "prompt A",
    once: false,
  });
  await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "@daily",
    description: "Task B",
    prompt: "prompt B",
    once: true,
  });

  const tasks = scheduler.list();

  expect(tasks).toHaveLength(2);
  const taskA = tasks.find((t) => t.description === "Task A");
  expect(taskA?.kind).toBe("session");
  expect(taskA?.prompt).toBe("prompt A");
  expect(taskA?.sessionId).toBe("session-1");

  const taskB = tasks.find((t) => t.description === "Task B");
  expect(taskB?.kind).toBe("background");
  expect(taskB?.prompt).toBe("prompt B");
  expect(taskB?.once).toBe(true);
});

test("list() returns empty array when no tasks exist", () => {
  expect(scheduler.list()).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// get()
// ---------------------------------------------------------------------------

test("get() returns task by ID", async () => {
  const created = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "find me",
    prompt: "p",
    once: false,
  });

  const found = scheduler.get(created.id);
  expect(found.id).toBe(created.id);
  expect(found.description).toBe("find me");
});

test("get() throws NotFoundError for missing ID", () => {
  expect(() => scheduler.get("nonexistent")).toThrow(Scheduler.NotFoundError);
});

// ---------------------------------------------------------------------------
// delete()
// ---------------------------------------------------------------------------

test("delete() removes task from database", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "to delete",
    prompt: "p",
    once: false,
  });

  await scheduler.delete(task.id);
  expect(scheduler.list()).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// trigger()
// ---------------------------------------------------------------------------

test("trigger() executes session task immediately", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "trigger me",
    prompt: "run this",
    once: false,
  });

  await scheduler.trigger(task.id);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-1",
      parts: [{ type: "text", text: "[Scheduled Task] run this" }],
    }),
    { throwOnError: true },
  );
});

test("trigger() includes agent when getSessionAgent returns a value", async () => {
  mockGetSessionAgent.mockReturnValue("my-agent");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "agent task",
    prompt: "agent prompt",
    once: false,
  });

  await scheduler.trigger(task.id);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-1",
      agent: "my-agent",
    }),
    { throwOnError: true },
  );
});

test("trigger() throws NotFoundError when task is missing", async () => {
  await expect(scheduler.trigger("no-such-id")).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

test("update() changes description", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "old",
    prompt: "p",
    once: false,
  });

  const updated = await scheduler.update(task.id, {
    description: "new description",
  });

  expect(updated.description).toBe("new description");
  expect(updated.cron).toBe("0 * * * *");
});

test("update() changes prompt", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "old prompt",
    once: false,
  });

  const updated = await scheduler.update(task.id, { prompt: "new prompt" });
  expect(updated.prompt).toBe("new prompt");
});

test("update() changes cron and restarts timer", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  const updated = await scheduler.update(task.id, { cron: "@daily" });
  expect(updated.cron).toBe("@daily");
});

test("update() cron on task with invalid cron handles missing timer", async () => {
  // Create task with a cron that will fail to parse (no timer started)
  cronParseSpy.mockImplementation(() => {
    throw new Error("bad");
  });
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "invalid",
    description: "no timer",
    prompt: "p",
    once: false,
  });

  // Restore valid cron parsing, then update cron
  cronParseSpy.mockImplementation(() => new Date(Date.now() + 60_000));
  const updated = await scheduler.update(task.id, { cron: "0 * * * *" });

  expect(updated.cron).toBe("0 * * * *");
});

test("update() with no changes returns task unchanged", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  const updated = await scheduler.update(task.id, {});
  expect(updated.description).toBe("d");
  expect(updated.prompt).toBe("p");
  expect(updated.cron).toBe("0 * * * *");
});

test("update() throws NotFoundError for missing ID", async () => {
  await expect(
    scheduler.update("nonexistent", { prompt: "x" }),
  ).rejects.toThrow(Scheduler.NotFoundError);
});

// ---------------------------------------------------------------------------
// #execute — background kind
// ---------------------------------------------------------------------------

async function triggerBackground(taskId: string) {
  const promise = scheduler.trigger(taskId);
  await vi.advanceTimersByTimeAsync(2000);
  return promise;
}

function mockBackgroundResponse(text: string) {
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "assistant" }, parts: [{ type: "text", text }] }],
  });
}

test("background task sends response to Telegram when meaningful", async () => {
  mockBackgroundResponse("Important report data");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg report",
    prompt: "check data",
    once: false,
  });

  await triggerBackground(task.id);

  expect(opencodeClient.session.create).toHaveBeenCalledWith(
    {},
    { throwOnError: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ sessionID: "ephemeral-session-1" }),
    { throwOnError: true },
  );
  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "Important report data",
    {},
  );
  expect(opencodeClient.session.abort).toHaveBeenCalledWith({
    sessionID: "ephemeral-session-1",
  });
});

test("background task skips Telegram when response is NO_REPORT", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg check",
    prompt: "check status",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
  expect(opencodeClient.session.abort).toHaveBeenCalled();
});

test("background task cleans up ephemeral session on error", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce(
    new Error("AI failed"),
  );

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg fail",
    prompt: "fail prompt",
    once: false,
  });

  await expect(scheduler.trigger(task.id)).rejects.toThrow("AI failed");
  expect(opencodeClient.session.abort).toHaveBeenCalledWith({
    sessionID: "ephemeral-session-1",
  });
});

test("background task with threadId sends to correct thread", async () => {
  const schema = await import("~/lib/schema");
  database
    .insert(schema.session)
    .values({ id: "session-thread", chatId: 456, threadId: 42 })
    .run();
  existingSessions.get.mockReturnValue({ chatId: 456, threadId: 42 });
  mockBackgroundResponse("Thread report");

  const task = await scheduler.create({
    sessionId: "session-thread",
    kind: "background",
    cron: "0 * * * *",
    description: "threaded bg",
    prompt: "check thread",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(456, "Thread report", {
    message_thread_id: 42,
  });
});

test("background task skips when response contains NO_REPORT marker", async () => {
  mockBackgroundResponse("After checking: [NO_REPORT]");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "truncated",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task skips notification when no text in messages", async () => {
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [
      {
        info: { role: "assistant" },
        parts: [{ type: "tool", id: "t1", tool: "bash", state: "done" }],
      },
    ],
  });

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "no text",
    prompt: "check files",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task logs warning when ephemeral session abort fails", async () => {
  opencodeClient.session.abort.mockRejectedValueOnce(new Error("abort failed"));

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "abort error test",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task.id);

  expect(opencodeClient.session.abort).toHaveBeenCalled();
});

test("background task polls while session is busy then reads result", async () => {
  // First poll: busy
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "busy" } },
  });
  // Second poll: idle with result
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "idle" } },
  });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [
      {
        info: { role: "assistant" },
        parts: [
          {
            type: "text",
            text: "Polled result",
          },
        ],
      },
    ],
  });

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "poll test",
    prompt: "check",
    once: false,
  });

  const promise = scheduler.trigger(task.id);
  // Advance past first poll (busy) and second poll (idle)
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(2000);
  await promise;

  expect(opencodeClient.session.status).toHaveBeenCalledTimes(2);
  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "Polled result",
    {},
  );
});

test("background task continues polling on retry status then resolves", async () => {
  // First poll: retry (not busy, not idle — loop continues)
  opencodeClient.session.status.mockResolvedValueOnce({
    data: {
      "ephemeral-session-1": {
        type: "retry",
        attempt: 1,
        message: "retrying",
        next: Date.now() + 1000,
      },
    },
  });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "user" }, parts: [] }],
  });
  // Second poll: idle with result
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "idle" } },
  });
  mockBackgroundResponse("Retry result");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "retry poll",
    prompt: "check",
    once: false,
  });

  const promise = scheduler.trigger(task.id);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(2000);
  await promise;

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(123, "Retry result", {});
});

test("background task breaks on idle with no text response", async () => {
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "idle" } },
  });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "user" }, parts: [] }],
  });

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "idle no text",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task breaks when session not in status map", async () => {
  opencodeClient.session.status.mockResolvedValueOnce({ data: {} });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "user" }, parts: [] }],
  });

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "no status",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task.id);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task skips execution when location is undefined", async () => {
  existingSessions.get.mockReturnValueOnce(undefined);

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg no location",
    prompt: "check",
    once: false,
  });

  await scheduler.trigger(task.id);

  expect(opencodeClient.session.create).not.toHaveBeenCalled();
  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("delete() throws NotFoundError for nonexistent ID", async () => {
  await expect(scheduler.delete("nonexistent")).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

// ---------------------------------------------------------------------------
// Timer lifecycle
// ---------------------------------------------------------------------------

test("timer fires and executes session task", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "timed",
    prompt: "auto run",
    once: false,
  });

  await vi.advanceTimersByTimeAsync(60_000);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-1",
      parts: [{ type: "text", text: "[Scheduled Task] auto run" }],
    }),
    { throwOnError: true },
  );
});

test("timer skips execution when task was deleted while waiting", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "will be deleted",
    prompt: "p",
    once: false,
  });

  // Delete the task from DB but leave the timer running
  const schema = await import("~/lib/schema");
  const { eq } = await import("drizzle-orm");
  database
    .delete(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, task.id))
    .run();

  await vi.advanceTimersByTimeAsync(60_000);

  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("once task deletes itself after firing", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "once",
    prompt: "one time",
    once: true,
  });

  expect(scheduler.list()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(scheduler.list()).toHaveLength(0);
});

test("dispose clears all timers", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  scheduler[Symbol.dispose]();

  await vi.advanceTimersByTimeAsync(120_000);
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("recurring task re-schedules after error", async () => {
  opencodeClient.session.promptAsync
    .mockRejectedValueOnce(new Error("transient"))
    .mockResolvedValueOnce({ data: undefined });

  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "retry",
    prompt: "retry me",
    once: false,
  });

  await vi.advanceTimersByTimeAsync(60_000);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(60_000);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledTimes(2);
});

test("once task does not re-schedule after error", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce(
    new Error("once fail"),
  );

  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "once error",
    prompt: "fail once",
    once: true,
  });

  await vi.advanceTimersByTimeAsync(60_000);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledTimes(1);

  // Should NOT fire again since it's a once task
  await vi.advanceTimersByTimeAsync(60_000);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledTimes(1);
});

test("stopTimer is safe when no timer exists for id", async () => {
  // delete() calls #stopTimer internally — deleting an already-deleted task
  // exercises the path where the timer map has no entry
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  await scheduler.delete(task.id);
  // Second delete throws NotFoundError, but the first delete already cleared
  // the timer — verify the internal #stopTimer didn't break
  await expect(scheduler.delete(task.id)).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------

test("NotFoundError has correct message and id property", () => {
  const error = new Scheduler.NotFoundError("abc-123");
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(Scheduler.NotFoundError);
  expect(error.message).toBe("Scheduled task not found: abc-123");
  expect(error.id).toBe("abc-123");
});

// ---------------------------------------------------------------------------
// Invalid kind validation
// ---------------------------------------------------------------------------

test("throws on unknown task kind from database", async () => {
  const schema = await import("~/lib/schema");
  database
    .insert(schema.scheduledTask)
    .values({
      id: "bad-kind-task",
      sessionId: "session-1",
      kind: "invalid",
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
      once: 0,
    })
    .run();

  expect(() => scheduler.get("bad-kind-task")).toThrow(
    "Unknown scheduled task kind: invalid",
  );
});

// ---------------------------------------------------------------------------
// Startup loads existing tasks
// ---------------------------------------------------------------------------

test("startup loads existing tasks and starts timers", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "persisted",
    prompt: "auto run on startup",
    once: false,
  });
  scheduler[Symbol.dispose]();

  scheduler = Scheduler.create(
    mockBot as never,
    database,
    opencodeClient as never,
    existingSessions as never,
  );

  await vi.advanceTimersByTimeAsync(60_000);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "[Scheduled Task] auto run on startup" }],
    }),
    { throwOnError: true },
  );
});
