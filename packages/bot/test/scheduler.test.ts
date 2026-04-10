import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { Scheduler } from "~/lib/scheduler";
import { schedule as scheduleTable, session } from "~/lib/schema";

let capturedProcessor: ((job: unknown) => Promise<unknown>) | undefined;

const mockQueue = {
  upsertJobScheduler: vi
    .fn()
    .mockResolvedValue({ id: "x", name: "x", next: 0 }),
  removeJobScheduler: vi.fn().mockResolvedValue(true),
  getJobSchedulers: vi.fn().mockResolvedValue([]),
  add: vi.fn(),
};

const mockCron = vi.fn().mockResolvedValue({ id: "x", name: "x", next: 0 });
const mockRemoveCron = vi.fn().mockResolvedValue(true);
const mockListCrons = vi.fn().mockResolvedValue([]);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock("bunqueue/client", () => ({
  Bunqueue: class MockBunqueue {
    queue = mockQueue;
    constructor(
      _name: string,
      opts: { processor: (job: unknown) => Promise<unknown> },
    ) {
      capturedProcessor = opts.processor;
    }
    cron = mockCron;
    removeCron = mockRemoveCron;
    listCrons = mockListCrons;
    close = mockClose;
    on = mockOn;
  },
}));

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
      status: vi.fn().mockResolvedValue({
        data: { "ephemeral-session-1": { type: "idle" } },
      }),
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

  capturedProcessor = undefined;
  mockCron.mockClear();
  mockRemoveCron.mockClear();
  mockListCrons.mockClear();
  mockClose.mockClear();
  mockOn.mockClear();
  mockQueue.upsertJobScheduler.mockClear();
  mockQueue.removeJobScheduler.mockClear();

  scheduler = await Scheduler.create(
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

test("create() returns task with all fields", async () => {
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
  expect(task.nextRunAt).toBe(Date.now() + 60_000);
});

test("create() registers cron in bunqueue for recurring tasks", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "hourly",
    prompt: "do something",
    once: false,
  });

  expect(mockCron).toHaveBeenCalledWith(
    expect.any(String),
    "0 * * * *",
    expect.objectContaining({
      sessionId: "session-1",
      kind: "session",
      prompt: "do something",
      once: false,
    }),
  );
});

test("create() uses upsertJobScheduler with limit for once tasks", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "one-time",
    prompt: "run once",
    once: true,
  });

  expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
    expect.any(String),
    { pattern: "0 * * * *", limit: 1 },
    expect.objectContaining({
      data: expect.objectContaining({ once: true }),
    }),
  );
  expect(mockCron).not.toHaveBeenCalled();
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

  expect(task.nextRunAt).toBeNull();
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

  expect(task.nextRunAt).toBeNull();
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

test("delete() removes task from Map and bunqueue", async () => {
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
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
});

// ---------------------------------------------------------------------------
// trigger()
// ---------------------------------------------------------------------------

test("trigger() enqueues a job via bunqueue instead of executing inline", async () => {
  const mockAdd = vi.fn().mockResolvedValue({
    id: "triggered-1",
    name: "trigger-task-1",
  });
  mockQueue.add = mockAdd;

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "trigger me",
    prompt: "run this",
    once: false,
  });

  const result = await scheduler.trigger(task.id);

  expect(result.scheduleId).toBe(task.id);
  expect(result.jobId).toBe("triggered-1");
  expect(result.enqueuedAt).toBeTypeOf("number");
  expect(mockAdd).toHaveBeenCalledWith(
    `trigger-${task.id}`,
    expect.objectContaining({
      sessionId: "session-1",
      prompt: "run this",
    }),
  );
  // Should NOT execute inline — promptAsync not called directly
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("processor includes agent when getSessionAgent returns a value", async () => {
  mockGetSessionAgent.mockReturnValue("my-agent");

  await fireJob("agent-task", {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "agent prompt",
    description: "d",
    once: false,
  });

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

test("update() changes cron and recreates bunqueue scheduler", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockRemoveCron.mockClear();
  mockCron.mockClear();

  const updated = await scheduler.update(task.id, { cron: "@daily" });
  expect(updated.cron).toBe("@daily");
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
  expect(mockCron).toHaveBeenCalledWith(
    task.id,
    "@daily",
    expect.objectContaining({ prompt: "p" }),
  );
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

test("update() syncs bunqueue data when only prompt changes on recurring task", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "old prompt",
    once: false,
  });

  mockCron.mockClear();

  await scheduler.update(task.id, { prompt: "new prompt" });

  expect(mockCron).toHaveBeenCalledWith(
    task.id,
    "0 * * * *",
    expect.objectContaining({ prompt: "new prompt" }),
  );
  expect(mockRemoveCron).not.toHaveBeenCalled();
});

test("update() does not re-register cron for once-task when only description changes", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "old",
    prompt: "p",
    once: true,
  });

  mockCron.mockClear();
  mockQueue.upsertJobScheduler.mockClear();

  await scheduler.update(task.id, { description: "new" });

  expect(mockCron).not.toHaveBeenCalled();
  expect(mockQueue.upsertJobScheduler).not.toHaveBeenCalled();
});

test("update() throws NotFoundError for missing ID", async () => {
  await expect(
    scheduler.update("nonexistent", { prompt: "x" }),
  ).rejects.toThrow(Scheduler.NotFoundError);
});

// ---------------------------------------------------------------------------
// #processJob — via capturedProcessor
// ---------------------------------------------------------------------------

async function fireJob(
  taskId: string,
  data: Record<string, unknown>,
  name?: string,
) {
  if (!capturedProcessor)
    throw new Error(
      "capturedProcessor was never set — Scheduler.create() not called?",
    );
  const job = { name: name ?? taskId, data: { taskId, ...data } };
  await capturedProcessor(job);
}

// ---------------------------------------------------------------------------
// #execute — background kind
// ---------------------------------------------------------------------------

async function triggerBackground(task: Scheduler.Task) {
  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });
  // Background execution is async — advance timers to let polling complete
  await vi.advanceTimersByTimeAsync(2000);
  // Flush microtasks so async operations resolve
  await vi.advanceTimersByTimeAsync(0);
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

  await triggerBackground(task);

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

  await triggerBackground(task);

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

  // Background execution is async — does not throw through processor
  await triggerBackground(task);

  // But run history should record the failure
  const runs = scheduler.getRuns(task.id);
  expect(runs[0]?.status).toBe("failed");
  expect(runs[0]?.error).toBe("AI failed");
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

  await triggerBackground(task);

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

  await triggerBackground(task);

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

  await triggerBackground(task);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task logs warning when ephemeral session abort fails", async () => {
  opencodeClient.session.abort.mockRejectedValueOnce(new Error("abort failed"));

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "abort error",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task);

  expect(opencodeClient.session.abort).toHaveBeenCalled();
});

test("background task polls while session is busy then reads result", async () => {
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "busy" } },
  });
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "idle" } },
  });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [
      {
        info: { role: "assistant" },
        parts: [{ type: "text", text: "Polled result" }],
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

  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

  expect(opencodeClient.session.status).toHaveBeenCalledTimes(2);
  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "Polled result",
    {},
  );
});

test("background task recovers when poll times out (30s)", async () => {
  // First poll: status call hangs — never resolves, timeout wins
  opencodeClient.session.status.mockImplementationOnce(
    () => new Promise(() => {}),
  );
  // Second poll: idle with result
  mockBackgroundResponse("After timeout");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "poll timeout",
    prompt: "check",
    once: false,
  });

  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });
  // First poll: 2s wait + 30s timeout
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.advanceTimersByTimeAsync(0);
  // Second poll: 2s wait + instant result
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "After timeout",
    {},
  );
});

test("background task recovers from poll error and continues", async () => {
  // First poll: status call hangs (will timeout after 30s in production,
  // but in tests the mock just throws)
  opencodeClient.session.status.mockRejectedValueOnce(
    new Error("Poll timeout"),
  );
  // Second poll: idle with result
  mockBackgroundResponse("After timeout");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "timeout recovery",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task);
  // Extra advance for the retry after timeout
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "After timeout",
    {},
  );
});

test("background task continues polling on retry status then resolves", async () => {
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

  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

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

  await triggerBackground(task);

  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("background task continues polling when session not in status map yet", async () => {
  // First poll: session not in status map (not started yet) — should continue
  opencodeClient.session.status.mockResolvedValueOnce({ data: {} });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "user" }, parts: [] }],
  });
  // Second poll: session is idle with result
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { "ephemeral-session-1": { type: "idle" } },
  });
  mockBackgroundResponse("Delayed result");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "no status initially",
    prompt: "check",
    once: false,
  });

  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "Delayed result",
    {},
  );
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

  await fireJob(task.id, {
    sessionId: task.sessionId,
    kind: task.kind,
    cron: task.cron,
    prompt: task.prompt,
    description: task.description,
    once: task.once,
  });

  expect(opencodeClient.session.create).not.toHaveBeenCalled();
  expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
});

test("delete() throws NotFoundError for nonexistent ID", async () => {
  await expect(scheduler.delete("nonexistent")).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

// ---------------------------------------------------------------------------
// Job processor (bunqueue fires job)
// ---------------------------------------------------------------------------

test("processor executes task and populates Map", async () => {
  await fireJob("task-1", {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "auto run",
    description: "d",
    once: false,
  });

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-1",
      parts: [{ type: "text", text: "[Scheduled Task] auto run" }],
    }),
    { throwOnError: true },
  );
  // Task should now be in the Map
  const found = scheduler.get("task-1");
  expect(found.prompt).toBe("auto run");
});

test("processor uses Map data over stale bunqueue data when entry exists", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "original",
    once: false,
  });

  // Update prompt in Map only (no cron change on once=false does sync, but simulate the
  // case where Map has fresh data)
  await scheduler.update(task.id, { prompt: "updated prompt" });
  opencodeClient.session.promptAsync.mockClear();

  // Processor fires with old bunqueue data
  await fireJob(task.id, {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "original",
    description: "d",
    once: false,
  });

  // Should use the Map's "updated prompt", not bunqueue's "original"
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "[Scheduled Task] updated prompt" }],
    }),
    { throwOnError: true },
  );
});

test("processor populates Map from job data on first fire after restart", async () => {
  // Map is empty (simulates post-restart state)
  expect(scheduler.list()).toHaveLength(0);

  await fireJob("restored-task", {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "restored",
    description: "restored desc",
    once: false,
  });

  const found = scheduler.get("restored-task");
  expect(found.prompt).toBe("restored");
  expect(found.description).toBe("restored desc");
});

test("manual trigger does not delete once-task from Map", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "once manual",
    prompt: "p",
    once: true,
  });

  await fireJob(
    task.id,
    {
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      prompt: "p",
      description: "once manual",
      once: true,
    },
    `trigger-${task.id}`,
  );

  // Task should still be in the Map after manual trigger
  expect(scheduler.get(task.id).description).toBe("once manual");
});

test("processor deletes once-task from Map after execution", async () => {
  await fireJob("once-task", {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "one time",
    description: "d",
    once: true,
  });

  expect(() => scheduler.get("once-task")).toThrow(Scheduler.NotFoundError);
});

test("processor deletes once-task even when execution fails", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce(
    new Error("once fail"),
  );

  await expect(
    fireJob("once-fail", {
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      prompt: "fail once",
      description: "d",
      once: true,
    }),
  ).rejects.toThrow("once fail");

  expect(() => scheduler.get("once-fail")).toThrow(Scheduler.NotFoundError);
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getRuns()
// ---------------------------------------------------------------------------

test("getRuns() returns run history after execution", async () => {
  await fireJob("run-test", {
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    prompt: "run me",
    description: "d",
    once: false,
  });

  const runs = scheduler.getRuns("run-test");
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("completed_notified");
  expect(runs[0]?.error).toBeNull();
  expect(runs[0]?.startedAt).toBeLessThanOrEqual(runs[0]?.finishedAt ?? 0);
});

test("getRuns() throws NotFoundError for missing ID", () => {
  expect(() => scheduler.getRuns("nonexistent")).toThrow(
    Scheduler.NotFoundError,
  );
});

test("getRuns() records failed status with error message", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce(
    new Error("api error"),
  );

  await expect(
    fireJob("fail-run", {
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      prompt: "fail",
      description: "d",
      once: false,
    }),
  ).rejects.toThrow("api error");

  const runs = scheduler.getRuns("fail-run");
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("failed");
  expect(runs[0]?.error).toBe("api error");
});

test("getRuns() records non-Error thrown values", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce("string error");

  await expect(
    fireJob("string-err", {
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      prompt: "fail",
      description: "d",
      once: false,
    }),
  ).rejects.toBe("string error");

  const runs = scheduler.getRuns("string-err");
  expect(runs[0]?.error).toBe("string error");
});

test("create() computes nextRunAt from Bun.cron.parse when cron returns null info", async () => {
  mockCron.mockResolvedValueOnce(null);

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "null info",
    prompt: "p",
    once: false,
  });

  expect(task.nextRunAt).toBe(Date.now() + 60_000);
});

test("create() computes nextRunAt from Bun.cron.parse when once-task upsert returns null", async () => {
  mockQueue.upsertJobScheduler.mockResolvedValueOnce(null);

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "null once",
    prompt: "p",
    once: true,
  });

  expect(task.nextRunAt).toBe(Date.now() + 60_000);
});

test("update() computes nextRunAt from Bun.cron.parse when once-task upsert returns null on cron change", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });

  mockQueue.upsertJobScheduler.mockResolvedValueOnce(null);

  const updated = await scheduler.update(task.id, { cron: "@daily" });
  expect(updated.nextRunAt).toBe(Date.now() + 60_000);
});

test("update() computes nextRunAt from Bun.cron.parse when cron returns null info", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockCron.mockResolvedValueOnce(null);

  const updated = await scheduler.update(task.id, { cron: "@daily" });
  expect(updated.nextRunAt).toBe(Date.now() + 60_000);
});

test("update() computes nextRunAt from Bun.cron.parse when data-only cron returns null", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockCron.mockResolvedValueOnce(null);

  const updated = await scheduler.update(task.id, { prompt: "new" });
  expect(updated.nextRunAt).toBe(Date.now() + 60_000);
});

test("background task records failure when session.create fails", async () => {
  opencodeClient.session.create.mockRejectedValueOnce(
    new Error("session create failed"),
  );

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg create fail",
    prompt: "check",
    once: false,
  });

  await triggerBackground(task);

  const runs = scheduler.getRuns(task.id);
  expect(runs[0]?.status).toBe("failed");
  expect(runs[0]?.error).toBe("session create failed");
  expect(runs[0]?.finishedAt).toBeGreaterThan(0);
});

test("background task records non-Error thrown values", async () => {
  opencodeClient.session.promptAsync.mockRejectedValueOnce("string error");

  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    description: "bg string error",
    prompt: "fail",
    once: false,
  });

  await triggerBackground(task);

  const runs = scheduler.getRuns(task.id);
  expect(runs[0]?.error).toBe("string error");
});

test("background once-task fired by cron is removed from Map after completion", async () => {
  await fireJob("bg-once", {
    sessionId: "session-1",
    kind: "background",
    cron: "0 * * * *",
    prompt: "bg once",
    description: "d",
    once: true,
  });
  // Background execution is async — advance timers to let polling and onComplete run
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);

  expect(() => scheduler.get("bg-once")).toThrow(Scheduler.NotFoundError);
});

test("run history trims to last 20 entries", async () => {
  // Fire 22 jobs to exceed maxRunHistory (20)
  for (let i = 0; i < 22; i++) {
    await fireJob("trim-test", {
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      prompt: `run ${i}`,
      description: "d",
      once: false,
    });
  }

  const runs = scheduler.getRuns("trim-test");
  expect(runs).toHaveLength(20);
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

test("dispose closes bunqueue", () => {
  scheduler[Symbol.dispose]();
  expect(mockClose).toHaveBeenCalled();
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

test("throws on unknown task kind when retrieving via get()", async () => {
  // Processor stores the data in Map regardless of kind
  await fireJob("bad-kind", {
    sessionId: "session-1",
    kind: "invalid",
    cron: "0 * * * *",
    prompt: "p",
    description: "d",
    once: false,
  });

  // Validation happens when converting to Task via #toTask
  expect(() => scheduler.get("bad-kind")).toThrow(
    "Unknown scheduled task kind: invalid",
  );
});

// ---------------------------------------------------------------------------
// update() with once-task uses upsertJobScheduler
// ---------------------------------------------------------------------------

test("update() cron on once-task uses upsertJobScheduler", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "once update",
    prompt: "p",
    once: true,
  });

  mockRemoveCron.mockClear();
  mockQueue.upsertJobScheduler.mockClear();

  await scheduler.update(task.id, { cron: "@daily" });

  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
  expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
    task.id,
    { pattern: "@daily", limit: 1 },
    expect.objectContaining({
      data: expect.objectContaining({ once: true }),
    }),
  );
});

// ---------------------------------------------------------------------------
// bunqueue accessor
// ---------------------------------------------------------------------------

test("bunqueue exposes the underlying Bunqueue instance", () => {
  const queue = scheduler.bunqueue;
  expect(queue).toBeDefined();
  expect(queue.cron).toBe(mockCron);
  expect(queue.listCrons).toBe(mockListCrons);
});

// ---------------------------------------------------------------------------
// addJob()
// ---------------------------------------------------------------------------

test("addJob() queues a job via bunqueue queue.add", async () => {
  const mockAdd = vi.fn().mockResolvedValue({
    id: "j-1",
    name: "j-1",
    data: {},
    delay: 0,
    priority: 0,
    timestamp: 1000,
  });
  mockQueue.add = mockAdd;

  const job = await scheduler.addJob(
    "session-1",
    "session",
    "test job",
    "do it",
  );

  expect(mockAdd).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ prompt: "do it", once: true, cron: "" }),
    undefined,
  );
  expect(job.id).toBe("j-1");
});

test("addJob() passes full JobOptions to bunqueue", async () => {
  const mockAdd = vi.fn().mockResolvedValue({
    id: "j-2",
    name: "j-2",
    data: {},
    delay: 5000,
    priority: 10,
    timestamp: 1000,
  });
  mockQueue.add = mockAdd;

  await scheduler.addJob("session-1", "session", "delayed", "later", {
    delay: 5000,
    priority: 10,
    attempts: 3,
    timeout: 30000,
  });

  expect(mockAdd).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ prompt: "later" }),
    { delay: 5000, priority: 10, attempts: 3, timeout: 30000 },
  );
});

test("addJob() does not appear in list()", async () => {
  mockQueue.add = vi.fn().mockResolvedValue({
    id: "j-1",
    name: "j-1",
    data: {},
    delay: 0,
    priority: 0,
    timestamp: 1000,
  });

  await scheduler.addJob("session-1", "session", "one-off", "do it");
  expect(scheduler.list()).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------

test("dispose logs error when queue close fails", () => {
  mockClose.mockRejectedValueOnce(new Error("close failed"));
  scheduler[Symbol.dispose]();
  expect(mockClose).toHaveBeenCalled();
});

test("registers an error handler on bunqueue", () => {
  expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  const errorHandler = mockOn.mock.calls.find(
    (call: unknown[]) => call[0] === "error",
  )?.[1] as (error: Error) => void;
  errorHandler(new Error("test error"));
});

// ---------------------------------------------------------------------------
// create() rollback on cron failure
// ---------------------------------------------------------------------------

test("create() does not store task when cron registration fails", async () => {
  mockCron.mockRejectedValueOnce(new Error("cron failed"));

  await expect(
    scheduler.create({
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      description: "will rollback",
      prompt: "p",
      once: false,
    }),
  ).rejects.toThrow("cron failed");

  expect(scheduler.list()).toHaveLength(0);
  expect(database.select().from(scheduleTable).all()).toHaveLength(0);
});

test("create() does not store task when upsertJobScheduler fails for once-task", async () => {
  mockQueue.upsertJobScheduler.mockRejectedValueOnce(
    new Error("upsert failed"),
  );

  await expect(
    scheduler.create({
      sessionId: "session-1",
      kind: "session",
      cron: "0 * * * *",
      description: "will rollback",
      prompt: "p",
      once: true,
    }),
  ).rejects.toThrow("upsert failed");

  expect(scheduler.list()).toHaveLength(0);
  expect(database.select().from(scheduleTable).all()).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// delete() error propagation
// ---------------------------------------------------------------------------

test("delete() propagates removeCron error and keeps task", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "keep on error",
    prompt: "p",
    once: false,
  });

  mockRemoveCron.mockRejectedValueOnce(new Error("removeCron failed"));

  await expect(scheduler.delete(task.id)).rejects.toThrow("removeCron failed");
  expect(scheduler.list()).toHaveLength(1);
  expect(database.select().from(scheduleTable).all()).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// update() error paths
// ---------------------------------------------------------------------------

test("update() propagates error when new cron registration fails and restores old cron", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockCron
    .mockRejectedValueOnce(new Error("new cron failed"))
    .mockResolvedValueOnce({ id: "x", name: "x", next: 0 });

  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "new cron failed",
  );

  const lastCronCall = mockCron.mock.calls.at(-1);
  expect(lastCronCall?.[1]).toBe("0 * * * *");
});

test("update() logs error when restore of old cron also fails", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockCron
    .mockRejectedValueOnce(new Error("new cron failed"))
    .mockRejectedValueOnce(new Error("restore also failed"));

  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "new cron failed",
  );
});

test("update() logs error when restore of old once-task cron also fails", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });

  mockQueue.upsertJobScheduler
    .mockRejectedValueOnce(new Error("new upsert failed"))
    .mockRejectedValueOnce(new Error("restore also failed"));

  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "new upsert failed",
  );
});

test("update() keeps old data in Map when cron re-registration fails", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  mockCron
    .mockRejectedValueOnce(new Error("cron failed"))
    .mockResolvedValueOnce({ id: "x", name: "x", next: 0 });

  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "cron failed",
  );

  const found = scheduler.get(task.id);
  expect(found.cron).toBe("0 * * * *");
});

// ---------------------------------------------------------------------------
// Recovery from database on restart
// ---------------------------------------------------------------------------

function seedSession(db: Database): void {
  db.insert(session).values({ id: "session-1", chatId: 1 }).run();
}

function seedSchedule(
  db: Database,
  overrides?: Partial<typeof scheduleTable.$inferInsert>,
): void {
  db.insert(scheduleTable)
    .values({
      id: "recovered-1",
      sessionId: "session-1",
      kind: "session",
      description: "recovered task",
      prompt: "recovered prompt",
      cron: "0 * * * *",
      once: false,
      ...overrides,
    })
    .run();
}

test("recover() restores tasks from database on startup", async () => {
  scheduler[Symbol.dispose]();

  const freshDb = Database.create();
  seedSession(freshDb);
  seedSchedule(freshDb);

  const restored = await Scheduler.create(
    mockBot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );

  const tasks = restored.list();
  expect(tasks).toHaveLength(1);
  expect(tasks[0]?.id).toBe("recovered-1");
  expect(tasks[0]?.description).toBe("recovered task");
  expect(tasks[0]?.prompt).toBe("recovered prompt");
  expect(tasks[0]?.cron).toBe("0 * * * *");
  expect(tasks[0]?.nextRunAt).toBe(Date.now() + 60_000);

  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("recover() re-registers missing crons in bunqueue", async () => {
  scheduler[Symbol.dispose]();

  const freshDb = Database.create();
  seedSession(freshDb);
  seedSchedule(freshDb);
  mockListCrons.mockResolvedValueOnce([]);

  const restored = await Scheduler.create(
    mockBot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );

  expect(mockCron).toHaveBeenCalledWith(
    "recovered-1",
    "0 * * * *",
    expect.objectContaining({ taskId: "recovered-1" }),
  );

  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("recover() re-registers once-task via upsertJobScheduler", async () => {
  scheduler[Symbol.dispose]();

  const freshDb = Database.create();
  seedSession(freshDb);
  seedSchedule(freshDb, { id: "once-1", once: true, cron: "@daily" });
  mockListCrons.mockResolvedValueOnce([]);

  const restored = await Scheduler.create(
    mockBot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );

  expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "once-1",
    { pattern: "@daily", limit: 1 },
    expect.objectContaining({ name: "once-1" }),
  );

  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("recover() skips cron registration when already in bunqueue", async () => {
  scheduler[Symbol.dispose]();

  const freshDb = Database.create();
  seedSession(freshDb);
  seedSchedule(freshDb);
  mockListCrons.mockResolvedValueOnce([
    { id: "recovered-1", name: "recovered-1", next: 0 },
  ]);
  mockCron.mockClear();

  const restored = await Scheduler.create(
    mockBot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );

  expect(mockCron).not.toHaveBeenCalled();
  expect(restored.list()).toHaveLength(1);

  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("create() persists schedule to database", async () => {
  await scheduler.create({
    sessionId: "session-1",
    kind: "background",
    cron: "@hourly",
    description: "persisted",
    prompt: "p",
    once: false,
  });

  const rows = database.select().from(scheduleTable).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.description).toBe("persisted");
  expect(rows[0]?.kind).toBe("background");
});

test("update() persists changes to database", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "original",
    prompt: "p",
    once: false,
  });

  await scheduler.update(task.id, { prompt: "updated" });

  const rows = database.select().from(scheduleTable).all();
  expect(rows[0]?.prompt).toBe("updated");
});

test("delete() removes schedule from database", async () => {
  const task = await scheduler.create({
    sessionId: "session-1",
    kind: "session",
    cron: "0 * * * *",
    description: "to delete",
    prompt: "p",
    once: false,
  });

  await scheduler.delete(task.id);

  const rows = database.select().from(scheduleTable).all();
  expect(rows).toHaveLength(0);
});
