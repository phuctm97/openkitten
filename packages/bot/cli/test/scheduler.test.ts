import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { Scheduler } from "~/lib/scheduler";
import {
  scheduleRun as scheduleRunTable,
  schedule as scheduleTable,
  session as sessionTable,
} from "~/lib/schema";

let capturedProcessor: ((job: unknown) => Promise<unknown>) | undefined;
const cronRegistry: Array<{ id: string; name: string; next: number }> = [];
const abortSignals = new Map<string, AbortController>();

const mockUpsert = vi.fn().mockImplementation((id: string) => {
  cronRegistry.push({ id, name: id, next: Date.now() + 60_000 });
  return Promise.resolve({ id, name: id, next: Date.now() + 60_000 });
});

const mockRemoveJobScheduler = vi.fn().mockImplementation((id: string) => {
  const idx = cronRegistry.findIndex((c) => c.id === id);
  if (idx >= 0) cronRegistry.splice(idx, 1);
  return Promise.resolve(true);
});

const mockAdd = vi.fn();
const mockCancel = vi.fn().mockImplementation((jobId: string) => {
  const controller = abortSignals.get(jobId);
  if (controller) controller.abort();
});
const mockGetSignal = vi.fn().mockImplementation((jobId: string) => {
  const existing = abortSignals.get(jobId);
  if (existing) return existing.signal;
  const controller = new AbortController();
  abortSignals.set(jobId, controller);
  return controller.signal;
});
const mockRemoveCron = vi.fn().mockImplementation((id: string) => {
  const idx = cronRegistry.findIndex((c) => c.id === id);
  if (idx >= 0) cronRegistry.splice(idx, 1);
  return Promise.resolve(true);
});
const mockListCrons = vi
  .fn()
  .mockImplementation(() => Promise.resolve([...cronRegistry]));
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockGetJobsAsync = vi.fn().mockResolvedValue([]);
const mockGetJob = vi
  .fn()
  .mockImplementation((id: string) => Promise.resolve({ id, name: id }));
const mockGetJobCountsAsync = vi.fn().mockResolvedValue({
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  prioritized: 0,
  paused: 0,
});
const mockIsPaused = vi.fn().mockReturnValue(false);

vi.mock("bunqueue/client", () => ({
  Bunqueue: class MockBunqueue {
    queue = {
      upsertJobScheduler: mockUpsert,
      removeJobScheduler: mockRemoveJobScheduler,
      add: mockAdd,
      getJobsAsync: mockGetJobsAsync,
    };
    constructor(
      _name: string,
      opts: { processor: (job: unknown) => Promise<unknown> },
    ) {
      capturedProcessor = opts.processor;
    }
    removeCron = mockRemoveCron;
    listCrons = mockListCrons;
    close = mockClose;
    on = mockOn;
    cancel = mockCancel;
    getSignal = mockGetSignal;
    getJob = mockGetJob;
    getJobCountsAsync = mockGetJobCountsAsync;
    isPaused = mockIsPaused;
  },
}));

const mockGetSessionAgent = vi.fn<(sessionId: string) => string | undefined>();

vi.mock("~/lib/get-session-agent", () => ({
  getSessionAgent: (_database: unknown, sessionId: string) =>
    mockGetSessionAgent(sessionId),
}));

let database: Database;
let bot: {
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
  get: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  check: ReturnType<typeof vi.fn>;
  unreachableLocations: { chatId: number; threadId: number }[];
};
let scheduler: Scheduler;

const ephemeralSessionId = "ephemeral-session-1";
const userSessionId = "sess-1";

beforeEach(async () => {
  vi.useFakeTimers();
  database = Database.create();
  bot = { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
  opencodeClient = {
    session: {
      promptAsync: vi.fn().mockResolvedValue({ data: undefined }),
      create: vi.fn().mockResolvedValue({ data: { id: ephemeralSessionId } }),
      abort: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        data: { [ephemeralSessionId]: { type: "idle" } },
      }),
      messages: vi.fn().mockResolvedValue({
        data: [
          {
            info: { role: "assistant" },
            parts: [{ type: "text", text: "[NO_REPORT]" }],
          },
        ],
      }),
    },
  };
  existingSessions = {
    get: vi.fn().mockReturnValue({ chatId: 123, threadId: undefined }),
    find: vi.fn().mockReturnValue(userSessionId),
    check: vi.fn().mockImplementation((id: string) => id === userSessionId),
    unreachableLocations: [],
  };
  mockGetSessionAgent.mockReturnValue(undefined);

  database
    .insert(sessionTable)
    .values({ id: userSessionId, chatId: 123, threadId: 0 })
    .run();

  capturedProcessor = undefined;
  cronRegistry.length = 0;
  abortSignals.clear();
  mockUpsert.mockClear();
  mockRemoveJobScheduler.mockClear();
  mockAdd.mockReset();
  mockAdd.mockResolvedValue({ id: "job-1", name: "job-1" });
  mockCancel.mockClear();
  mockGetSignal.mockClear();
  mockRemoveCron.mockClear();
  mockListCrons.mockClear();
  mockClose.mockClear();
  mockOn.mockClear();
  mockGetJob.mockReset();
  mockGetJob.mockImplementation((id: string) =>
    Promise.resolve({ id, name: id }),
  );

  scheduler = await Scheduler.create(
    bot as never,
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

async function fireCron(
  scheduleId: string,
  jobId = `cron-${scheduleId}`,
): Promise<void> {
  if (!capturedProcessor) throw new Error("processor not captured");
  await capturedProcessor({
    id: jobId,
    name: scheduleId,
    data: { scheduleId },
  });
}

async function fireManual(
  scheduleId: string,
  jobId = `manual-${scheduleId}`,
): Promise<void> {
  if (!capturedProcessor) throw new Error("processor not captured");
  await capturedProcessor({
    id: jobId,
    name: `trigger-${scheduleId}`,
    data: { scheduleId },
  });
}

function mockAssistantText(text: string): void {
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [{ info: { role: "assistant" }, parts: [{ type: "text", text }] }],
  });
}

async function advanceForExecution(): Promise<void> {
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
}

test("create() returns a task with all fields populated", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "Hourly",
    prompt: "do something",
    once: false,
  });
  expect(task.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(task.chatId).toBe(123);
  expect(task.threadId).toBe(0);
  expect(task.cron).toBe("0 * * * *");
  expect(task.timezone).toBe("UTC");
  expect(task.once).toBe(false);
  expect(task.enabled).toBe(true);
  expect(task.overlap).toBe("queue");
  expect(task.notifyOnFailure).toBe(false);
  expect(task.maxRuntimeMs).toBeNull();
});

test("create() respects all optional fields", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "@daily",
    description: "Custom",
    prompt: "p",
    once: true,
    timezone: "Asia/Ho_Chi_Minh",
    overlap: "skip",
    notifyOnFailure: true,
    maxRuntimeMs: 60000,
  });
  expect(task.timezone).toBe("Asia/Ho_Chi_Minh");
  expect(task.overlap).toBe("skip");
  expect(task.notifyOnFailure).toBe(true);
  expect(task.maxRuntimeMs).toBe(60000);
  expect(task.once).toBe(true);
});

test("create() registers with upsertJobScheduler for recurring tasks", async () => {
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      pattern: "0 * * * *",
      timezone: "UTC",
      preventOverlap: false,
    }),
    expect.objectContaining({ data: expect.any(Object) }),
  );
  const call = mockUpsert.mock.calls.at(-1);
  expect(call?.[1]).not.toHaveProperty("limit");
});

test("create() registers once-tasks with limit=1", async () => {
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ pattern: "0 * * * *", limit: 1 }),
    expect.any(Object),
  );
});

test("create() rolls back DB insert when register fails", async () => {
  mockUpsert.mockRejectedValueOnce(new Error("register failed"));
  await expect(
    scheduler.create({
      chatId: 123,
      cron: "0 * * * *",
      description: "d",
      prompt: "p",
      once: false,
    }),
  ).rejects.toThrow("register failed");
  expect(database.select().from(scheduleTable).all()).toHaveLength(0);
});

test("get() returns task by id", async () => {
  const created = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "find me",
    prompt: "p",
    once: false,
  });
  const found = scheduler.get(created.id);
  expect(found.description).toBe("find me");
});

test("get() throws NotFoundError for missing id", () => {
  expect(() => scheduler.get("nonexistent")).toThrow(Scheduler.NotFoundError);
});

test("list() returns empty array when none exist", () => {
  expect(scheduler.list()).toHaveLength(0);
});

test("list() returns all tasks", async () => {
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "A",
    prompt: "pA",
    once: false,
  });
  await scheduler.create({
    chatId: 123,
    cron: "@daily",
    description: "B",
    prompt: "pB",
    once: true,
  });
  const tasks = scheduler.list();
  expect(tasks).toHaveLength(2);
  expect(tasks.map((t) => t.description).sort()).toEqual(["A", "B"]);
});

test("list() filters by chatId/threadId", async () => {
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "A",
    prompt: "p",
    once: false,
  });
  await scheduler.create({
    chatId: 456,
    cron: "0 * * * *",
    description: "B",
    prompt: "p",
    once: false,
  });
  const filtered = scheduler.list({ chatId: 456, threadId: 0 });
  expect(filtered).toHaveLength(1);
  expect(filtered[0]?.description).toBe("B");
});

test("list() filters by chatId only", async () => {
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "A",
    prompt: "p",
    once: false,
  });
  await scheduler.create({
    chatId: 456,
    cron: "0 * * * *",
    description: "B",
    prompt: "p",
    once: false,
  });
  expect(scheduler.list({ chatId: 123 })).toHaveLength(1);
});

test("list() filters by enabled", async () => {
  const a = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "A",
    prompt: "p",
    once: false,
  });
  await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "B",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(a.id);
  expect(scheduler.list({ enabled: true })).toHaveLength(1);
  expect(scheduler.list({ enabled: false })).toHaveLength(1);
});

test("update() changes description without re-registering", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "old",
    prompt: "p",
    once: false,
  });
  mockUpsert.mockClear();
  mockRemoveCron.mockClear();
  const updated = await scheduler.update(task.id, { description: "new" });
  expect(updated.description).toBe("new");
  expect(mockUpsert).not.toHaveBeenCalled();
  expect(mockRemoveCron).not.toHaveBeenCalled();
});

test("update() changes prompt only", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "old",
    once: false,
  });
  const updated = await scheduler.update(task.id, { prompt: "new" });
  expect(updated.prompt).toBe("new");
});

test("update() re-registers when cron changes", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockUpsert.mockClear();
  mockRemoveCron.mockClear();
  const updated = await scheduler.update(task.id, { cron: "@daily" });
  expect(updated.cron).toBe("@daily");
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
  expect(mockUpsert).toHaveBeenCalled();
});

test("update() re-registers when timezone changes", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockUpsert.mockClear();
  const updated = await scheduler.update(task.id, {
    timezone: "Asia/Ho_Chi_Minh",
  });
  expect(updated.timezone).toBe("Asia/Ho_Chi_Minh");
  expect(mockUpsert).toHaveBeenCalled();
});

test("update() updates overlap and notifyOnFailure and maxRuntimeMs", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const updated = await scheduler.update(task.id, {
    overlap: "skip",
    notifyOnFailure: true,
    maxRuntimeMs: 30000,
  });
  expect(updated.overlap).toBe("skip");
  expect(updated.notifyOnFailure).toBe(true);
  expect(updated.maxRuntimeMs).toBe(30000);
});

test("update() with no changes is a no-op", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const updated = await scheduler.update(task.id, {});
  expect(updated.description).toBe("d");
  expect(updated.prompt).toBe("p");
});

test("update() throws NotFoundError for missing id", async () => {
  await expect(
    scheduler.update("nonexistent", { prompt: "x" }),
  ).rejects.toThrow(Scheduler.NotFoundError);
});

test("update() skips re-registration when schedule is disabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockUpsert.mockClear();
  mockRemoveCron.mockClear();
  await scheduler.update(task.id, { cron: "@daily" });
  expect(mockUpsert).not.toHaveBeenCalled();
  expect(mockRemoveCron).not.toHaveBeenCalled();
});

test("update() rolls back on register failure", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockUpsert.mockRejectedValueOnce(new Error("new register failed"));
  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "new register failed",
  );
  const row = scheduler.get(task.id);
  expect(row.cron).toBe("0 * * * *");
});

test("update() logs when restore of old cron also fails", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockUpsert
    .mockRejectedValueOnce(new Error("new failed"))
    .mockRejectedValueOnce(new Error("restore failed"));
  await expect(scheduler.update(task.id, { cron: "@daily" })).rejects.toThrow(
    "new failed",
  );
});

test("enable() is no-op when already enabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockUpsert.mockClear();
  await scheduler.enable(task.id);
  expect(mockUpsert).not.toHaveBeenCalled();
});

test("enable() re-registers a disabled schedule", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockUpsert.mockClear();
  const enabled = await scheduler.enable(task.id);
  expect(enabled.enabled).toBe(true);
  expect(mockUpsert).toHaveBeenCalled();
});

test("enable() rolls back on register failure", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockUpsert.mockRejectedValueOnce(new Error("enable failed"));
  await expect(scheduler.enable(task.id)).rejects.toThrow("enable failed");
  expect(scheduler.get(task.id).enabled).toBe(false);
});

test("disable() is no-op when already disabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockRemoveCron.mockClear();
  await scheduler.disable(task.id);
  expect(mockRemoveCron).not.toHaveBeenCalled();
});

test("disable() unregisters an enabled schedule", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockRemoveCron.mockClear();
  const disabled = await scheduler.disable(task.id);
  expect(disabled.enabled).toBe(false);
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
});

test("delete() removes schedule and unregisters when enabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockRemoveCron.mockClear();
  await scheduler.delete(task.id);
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
  expect(scheduler.list()).toHaveLength(0);
});

test("delete() skips unregister for disabled schedules", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockRemoveCron.mockClear();
  await scheduler.delete(task.id);
  expect(mockRemoveCron).not.toHaveBeenCalled();
});

test("delete() cancels in-flight run without queueJobId", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-noJob",
      scheduleId: task.id,
      trigger: "manual",
      status: "pending",
      startedAt: new Date(),
    })
    .run();
  mockCancel.mockClear();
  await scheduler.delete(task.id);
  expect(mockCancel).not.toHaveBeenCalled();
});

test("delete() cancels in-flight runs", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-inflight",
      scheduleId: task.id,
      queueJobId: "job-active",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  await scheduler.delete(task.id);
  expect(mockCancel).toHaveBeenCalledWith("job-active");
});

test("deleteByChat removes all schedules for chat/thread and unregisters enabled ones", async () => {
  const taskA = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "A",
    prompt: "p",
    once: false,
  });
  const taskB = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "B",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(taskB.id);
  await scheduler.create({
    chatId: 999,
    cron: "0 * * * *",
    description: "C",
    prompt: "p",
    once: false,
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-active-A",
      scheduleId: taskA.id,
      queueJobId: "job-active",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockRemoveCron.mockClear();
  mockCancel.mockClear();
  await scheduler.deleteByChat(123, 0);
  expect(mockRemoveCron).toHaveBeenCalledWith(taskA.id);
  expect(mockRemoveCron).not.toHaveBeenCalledWith(taskB.id);
  expect(mockCancel).toHaveBeenCalledWith("job-active");
  expect(scheduler.list({ chatId: 123 })).toHaveLength(0);
  expect(scheduler.list({ chatId: 999 })).toHaveLength(1);
});

test("Scheduler.create cleans up schedules for unreachable chats from initialize", async () => {
  scheduler[Symbol.dispose]();
  const freshDb = Database.create();
  freshDb
    .insert(scheduleTable)
    .values({
      id: "stale-schedule",
      chatId: 123,
      threadId: 0,
      description: "stale",
      prompt: "p",
      cron: "0 * * * *",
      enabled: true,
    })
    .run();
  freshDb
    .insert(scheduleTable)
    .values({
      id: "live-schedule",
      chatId: 555,
      threadId: 0,
      description: "live",
      prompt: "p",
      cron: "0 * * * *",
      enabled: true,
    })
    .run();
  mockListCrons.mockResolvedValue([]);
  mockUpsert.mockClear();
  const restored = await Scheduler.create(
    bot as never,
    freshDb,
    opencodeClient as never,
    {
      ...existingSessions,
      unreachableLocations: [{ chatId: 123, threadId: 0 }],
    } as never,
  );
  expect(() => restored.get("stale-schedule")).toThrow(Scheduler.NotFoundError);
  expect(restored.get("live-schedule").id).toBe("live-schedule");
  const upsertedIds = mockUpsert.mock.calls.map((call) => call[0] as string);
  expect(upsertedIds).not.toContain("stale-schedule");
  expect(upsertedIds).toContain("live-schedule");
  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("delete() throws NotFoundError for missing id", async () => {
  await expect(scheduler.delete("nonexistent")).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

test("trigger() pre-creates a pending run and returns its id", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockResolvedValue({ id: "triggered-1" });
  const result = await scheduler.trigger(task.id);
  expect(result.scheduleId).toBe(task.id);
  expect(result.queueJobId).toBe("triggered-1");
  expect(result.runId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(mockAdd).toHaveBeenCalledWith(`trigger-${task.id}`, {
    scheduleId: task.id,
    runId: result.runId,
  });
  const row = scheduler.getRun(result.runId);
  expect(row.status).toBe("pending");
  expect(row.trigger).toBe("manual");
  expect(row.scheduleId).toBe(task.id);
  expect(row.queueJobId).toBe("triggered-1");
});

test("cancelRun() cancels bunqueue job for a pre-pickup manual trigger", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockResolvedValue({ id: "manual-pending-1" });
  const { runId } = await scheduler.trigger(task.id);
  await scheduler.cancelRun(runId);
  expect(mockCancel).toHaveBeenCalledWith("manual-pending-1");
});

test("trigger() rolls back pre-created run when queue.add rejects", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockRejectedValueOnce(new Error("bunqueue down"));
  await expect(scheduler.trigger(task.id)).rejects.toThrow("bunqueue down");
  expect(scheduler.listRuns({ scheduleId: task.id })).toHaveLength(0);
});

test("trigger() throws NotFoundError for missing id", async () => {
  await expect(scheduler.trigger("nonexistent")).rejects.toThrow(
    Scheduler.NotFoundError,
  );
});

test("listRuns() returns runs filtered by scheduleId", async () => {
  const now = new Date();
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-1",
      scheduleId: "sched-1",
      trigger: "cron",
      status: "reported",
      startedAt: now,
      finishedAt: now,
      output: "hi",
    })
    .run();
  const runs = scheduler.listRuns({ scheduleId: "sched-1" });
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("reported");
  expect(runs[0]?.output).toBe("hi");
});

test("listRuns() filters by runSession, status, trigger, and time range", async () => {
  const now = Date.now();
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  const rows = [
    {
      id: "r-old",
      status: "reported",
      trigger: "cron",
      startedAt: now - 10000,
    },
    { id: "r-new", status: "failed", trigger: "manual", startedAt: now + 1000 },
    { id: "r-mid", status: "silent", trigger: "cron", startedAt: now - 2000 },
  ];
  for (const r of rows) {
    database
      .insert(scheduleRunTable)
      .values({
        id: r.id,
        scheduleId: "sched-1",
        runSessionId: userSessionId,
        trigger: r.trigger,
        status: r.status,
        startedAt: new Date(r.startedAt),
      })
      .run();
  }
  expect(scheduler.listRuns({ status: "failed" })).toHaveLength(1);
  expect(scheduler.listRuns({ trigger: "manual" })).toHaveLength(1);
  expect(scheduler.listRuns({ runSessionId: userSessionId })).toHaveLength(3);
  expect(
    scheduler.listRuns({ since: now - 5000, until: now + 500 }),
  ).toHaveLength(1);
});

test("listRuns() ignores out-of-range since/until values", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-range",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  const now = Date.now();
  database
    .insert(scheduleRunTable)
    .values({
      id: "r-in-range",
      scheduleId: "sched-range",
      trigger: "cron",
      status: "reported",
      startedAt: new Date(now),
    })
    .run();
  expect(
    scheduler.listRuns({
      scheduleId: "sched-range",
      since: 0,
      until: Number.MAX_SAFE_INTEGER,
    }),
  ).toHaveLength(1);
  expect(
    scheduler.listRuns({
      scheduleId: "sched-range",
      until: Number.MAX_SAFE_INTEGER,
    }),
  ).toHaveLength(1);
  expect(
    scheduler.listRuns({ scheduleId: "sched-range", since: now + 1000 }),
  ).toHaveLength(0);
});

test("listRuns() respects limit and offset", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  for (let i = 0; i < 5; i++) {
    database
      .insert(scheduleRunTable)
      .values({
        id: `r-${i}`,
        scheduleId: "sched-1",
        trigger: "cron",
        status: "silent",
        startedAt: new Date(Date.now() + i * 1000),
      })
      .run();
  }
  expect(scheduler.listRuns({ limit: 2 })).toHaveLength(2);
  expect(scheduler.listRuns({ limit: 2, offset: 2 })).toHaveLength(2);
});

test("getRun() returns a run by id", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-1",
      scheduleId: "sched-1",
      trigger: "cron",
      status: "reported",
      startedAt: new Date(),
    })
    .run();
  expect(scheduler.getRun("run-1").status).toBe("reported");
});

test("getRun() throws RunNotFoundError for missing id", () => {
  expect(() => scheduler.getRun("nonexistent")).toThrow(
    Scheduler.RunNotFoundError,
  );
});

test("cancelRun() cancels running run and calls bunqueue.cancel", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-live",
      scheduleId: "sched-1",
      queueJobId: "job-live",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  const result = await scheduler.cancelRun("run-live");
  expect(result.status).toBe("cancelled");
  expect(mockCancel).toHaveBeenCalledWith("job-live");
});

test("cancelRun() cancels pending run without queueJobId", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-pending",
      scheduleId: "sched-1",
      trigger: "manual",
      status: "pending",
      startedAt: new Date(),
    })
    .run();
  const result = await scheduler.cancelRun("run-pending");
  expect(result.status).toBe("cancelled");
});

test("cancelRun() throws RunNotFoundError for missing id", async () => {
  await expect(scheduler.cancelRun("nonexistent")).rejects.toThrow(
    Scheduler.RunNotFoundError,
  );
});

test("cancelRun() throws RunNotCancellableError on terminal status", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-1",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-done",
      scheduleId: "sched-1",
      trigger: "cron",
      status: "reported",
      startedAt: new Date(),
    })
    .run();
  await expect(scheduler.cancelRun("run-done")).rejects.toThrow(
    Scheduler.RunNotCancellableError,
  );
});

test("processor transitions pending run to running when runId is supplied", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockResolvedValue({ id: "manual-job-1" });
  const { runId } = await scheduler.trigger(task.id);
  if (!capturedProcessor) throw new Error("processor not captured");
  mockAssistantText("manual-done");
  const firePromise = capturedProcessor({
    id: "manual-job-1",
    name: `trigger-${task.id}`,
    data: { scheduleId: task.id, runId },
  });
  await advanceForExecution();
  await firePromise;
  const run = scheduler.getRun(runId);
  expect(run.status).toBe("reported");
  expect(run.queueJobId).toBe("manual-job-1");
  expect(run.output).toBe("manual-done");
  expect(scheduler.listRuns({ scheduleId: task.id })).toHaveLength(1);
});

test("processor skips when supplied runId was cancelled before pickup", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockResolvedValue({ id: "manual-job-2" });
  const { runId } = await scheduler.trigger(task.id);
  await scheduler.cancelRun(runId);
  if (!capturedProcessor) throw new Error("processor not captured");
  opencodeClient.session.create.mockClear();
  await capturedProcessor({
    id: "manual-job-2",
    name: `trigger-${task.id}`,
    data: { scheduleId: task.id, runId },
  });
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
  expect(scheduler.getRun(runId).status).toBe("cancelled");
});

test("processor skips when schedule no longer exists", async () => {
  await fireCron("ghost-id");
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
});

test("processor skips when job data is missing scheduleId", async () => {
  if (!capturedProcessor) throw new Error("processor not captured");
  await capturedProcessor({
    id: "job-empty",
    name: "cron-nothing",
    data: {},
  });
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
});

test("processor skips cron ticks when schedule is disabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  opencodeClient.session.create.mockClear();
  await fireCron(task.id);
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
});

test("processor accepts manual trigger even when disabled", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  await scheduler.disable(task.id);
  mockAssistantText("report");
  const firePromise = fireManual(task.id);
  await advanceForExecution();
  await firePromise;
  expect(opencodeClient.session.create).toHaveBeenCalled();
  expect(bot.api.sendMessage).toHaveBeenCalled();
});

test("create() with sessionId stores it on the task", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  expect(task.sessionId).toBe(userSessionId);
});

test("update() can rebind a schedule to a different sessionId", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const updated = await scheduler.update(task.id, {
    sessionId: userSessionId,
  });
  expect(updated.sessionId).toBe(userSessionId);
});

test("update({ sessionId: null }) converts session-bound back to chat-bound", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  const updated = await scheduler.update(task.id, { sessionId: null });
  expect(updated.sessionId).toBeNull();
});

test("session-bound run prompts into the pinned session without creating or aborting an ephemeral session", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  mockAssistantText("session update");
  opencodeClient.session.create.mockClear();
  opencodeClient.session.abort.mockClear();
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
  expect(opencodeClient.session.abort).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ sessionID: userSessionId }),
    expect.any(Object),
  );
});

test("session-bound run records reported output but does not post to Telegram", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  mockAssistantText("session update");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("reported");
  expect(runs[0]?.output).toBe("session update");
});

test("chat-bound run records runSessionId as the ephemeral session id for post-hoc inspection", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("x");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.runSessionId).toBe(ephemeralSessionId);
});

test("session-bound run records runSessionId as the pinned local session id", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  mockAssistantText("x");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.runSessionId).toBe(userSessionId);
});

test("session-bound run with external pin records the external id as runSessionId for inspection", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: "external-session-xyz",
  });
  mockAssistantText("x");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.runSessionId).toBe("external-session-xyz");
});

test("run cancelled before session acquisition leaves runSessionId null", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAdd.mockResolvedValueOnce({ id: "cancel-before-session" });
  const { runId } = await scheduler.trigger(task.id);
  await scheduler.cancelRun(runId);
  const run = scheduler.getRun(runId);
  expect(run.status).toBe("cancelled");
  expect(run.runSessionId).toBeNull();
});

test("reported run posts to Telegram and records output", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("Important report");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "Important report", {});
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("reported");
  expect(runs[0]?.output).toBe("Important report");
});

test("silent run with NO_REPORT marker sends nothing to Telegram", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("silent");
});

test("text containing NO_REPORT mid-sentence is reported, not silent", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText(
    "The marker [NO_REPORT] is a convention — here's the result.",
  );
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(
    123,
    "The marker [NO_REPORT] is a convention — here's the result.",
    {},
  );
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("reported");
});

test("NO_REPORT with trailing whitespace still counts as silent", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("  [NO_REPORT]\n");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("silent");
});

test("run with thread delivers to message_thread_id", async () => {
  const task = await scheduler.create({
    chatId: 456,
    threadId: 42,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("Thread report");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(456, "Thread report", {
    message_thread_id: 42,
  });
});

test("failed run records error and does not notify by default", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.promptAsync.mockRejectedValueOnce(
    new Error("AI down"),
  );
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect((caught as Error).message).toBe("AI down");
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("failed");
  expect(runs[0]?.error).toBe("AI down");
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
});

test("failed run with notifyOnFailure and thread sends to thread", async () => {
  const task = await scheduler.create({
    chatId: 789,
    threadId: 7,
    cron: "0 * * * *",
    description: "crit",
    prompt: "p",
    once: false,
    notifyOnFailure: true,
  });
  opencodeClient.session.promptAsync.mockRejectedValueOnce(new Error("db"));
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect((caught as Error).message).toBe("db");
  expect(bot.api.sendMessage).toHaveBeenCalledWith(789, expect.any(String), {
    message_thread_id: 7,
  });
});

test("failed run with notifyOnFailure sends Telegram alert", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "critical",
    prompt: "p",
    once: false,
    notifyOnFailure: true,
  });
  opencodeClient.session.promptAsync.mockRejectedValueOnce(new Error("boom"));
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect((caught as Error).message).toBe("boom");
  expect(bot.api.sendMessage).toHaveBeenCalledWith(
    123,
    expect.stringContaining("failed: boom"),
    {},
  );
});

test("failed run when session.create throws skips ephemeral abort", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.create.mockRejectedValueOnce(
    new Error("create failed"),
  );
  opencodeClient.session.abort.mockClear();
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect((caught as Error).message).toBe("create failed");
  expect(opencodeClient.session.abort).not.toHaveBeenCalled();
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("failed");
});

test("failed run records non-Error string exceptions", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.promptAsync.mockRejectedValueOnce("string-error");
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect(caught).toBe("string-error");
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.error).toBe("string-error");
});

test("failed run logs when notification delivery also fails", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    notifyOnFailure: true,
  });
  opencodeClient.session.promptAsync.mockRejectedValueOnce(new Error("x"));
  bot.api.sendMessage.mockRejectedValueOnce(new Error("notify failed"));
  let caught: unknown;
  const firePromise = fireCron(task.id).catch((e) => {
    caught = e;
  });
  await advanceForExecution();
  await firePromise;
  expect((caught as Error).message).toBe("x");
});

test("execution proceeds and reports when no chat session is mapped (agent override is simply skipped)", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  existingSessions.find.mockReturnValue(undefined);
  mockAssistantText("delivered");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "delivered", {});
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("reported");
});

test("execution aborts ephemeral session in finally even on success", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("ok");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(opencodeClient.session.abort).toHaveBeenCalledWith({
    sessionID: ephemeralSessionId,
  });
});

test("processor returns without awaiting ephemeral session abort", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("ok");
  const { promise: abortPromise, resolve: resolveAbort } =
    Promise.withResolvers<undefined>();
  opencodeClient.session.abort.mockReturnValueOnce(abortPromise);
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("reported");
  resolveAbort(undefined);
});

test("abort failure during cleanup is logged but not thrown", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  mockAssistantText("ok");
  opencodeClient.session.abort.mockRejectedValueOnce(new Error("abort failed"));
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await expect(firePromise).resolves.toBeUndefined();
});

test("agent from session is passed to ephemeral prompt", async () => {
  mockGetSessionAgent.mockReturnValue("custom-agent");
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(mockGetSessionAgent).toHaveBeenCalledWith(userSessionId);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "custom-agent" }),
    { throwOnError: true },
  );
});

test("chat-bound run looks up agent by chat session, not by the ephemeral run session", async () => {
  mockGetSessionAgent.mockImplementation((id) =>
    id === userSessionId ? "chat-agent" : undefined,
  );
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "chat-agent" }),
    { throwOnError: true },
  );
});

test("session-bound run looks up agent by the pinned session id", async () => {
  mockGetSessionAgent.mockImplementation((id) =>
    id === userSessionId ? "pinned-agent" : undefined,
  );
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: userSessionId,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(mockGetSessionAgent).toHaveBeenCalledWith(userSessionId);
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "pinned-agent" }),
    { throwOnError: true },
  );
});

test("session-bound run with external session id passes no agent override", async () => {
  mockGetSessionAgent.mockReturnValue("should-not-appear");
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    sessionId: "external-session-xyz",
  });
  mockAssistantText("x");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const promptCall = opencodeClient.session.promptAsync.mock.calls.at(-1);
  expect(promptCall?.[0]).not.toHaveProperty("agent");
});

test("once-task disables the schedule after a cron fire", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(scheduler.get(task.id).enabled).toBe(false);
  expect(mockRemoveCron).toHaveBeenCalledWith(task.id);
});

test("once-task manual trigger does not disable the schedule", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });
  const firePromise = fireManual(task.id);
  await advanceForExecution();
  await firePromise;
  expect(scheduler.get(task.id).enabled).toBe(true);
});

test("once-task logs when removeCron fails after fire", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: true,
  });
  mockRemoveCron.mockRejectedValueOnce(new Error("remove failed"));
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await expect(firePromise).resolves.toBeUndefined();
});

test("overlap=skip records skipped run when another is running", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
    overlap: "skip",
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-active",
      scheduleId: task.id,
      queueJobId: "job-active",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  await fireCron(task.id);
  const runs = scheduler.listRuns({ scheduleId: task.id });
  const skipped = runs.find((r) => r.status === "skipped");
  expect(skipped).toBeDefined();
  expect(opencodeClient.session.create).not.toHaveBeenCalled();
});

test("overlap=skip proceeds when nothing is running", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
    overlap: "skip",
  });
  mockAssistantText("hi");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalled();
});

test("overlap=cancel_previous with null queueJobId just updates status", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
    overlap: "cancel_previous",
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-nokey",
      scheduleId: task.id,
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockAssistantText("new");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const prev = scheduler.getRun("run-nokey");
  expect(prev.status).toBe("cancelled");
});

test("pending run status is parseable via getRun", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-p",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-pending",
      scheduleId: "sched-p",
      trigger: "manual",
      status: "pending",
      startedAt: new Date(),
    })
    .run();
  expect(scheduler.getRun("run-pending").status).toBe("pending");
});

test("overlap=cancel_previous cancels prior running run and proceeds", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
    overlap: "cancel_previous",
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-prev",
      scheduleId: task.id,
      queueJobId: "job-prev",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockAssistantText("new");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(mockCancel).toHaveBeenCalledWith("job-prev");
  const prev = scheduler.getRun("run-prev");
  expect(prev.status).toBe("cancelled");
});

test("overlap=queue runs both without cancellation", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-prev",
      scheduleId: task.id,
      queueJobId: "job-prev",
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockAssistantText("new");
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  expect(mockCancel).not.toHaveBeenCalled();
});

test("manual trigger ignores overlap policy", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
    overlap: "skip",
  });
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-active",
      scheduleId: task.id,
      trigger: "cron",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockAssistantText("manual");
  const firePromise = fireManual(task.id);
  await advanceForExecution();
  await firePromise;
  expect(opencodeClient.session.create).toHaveBeenCalled();
});

test("per-chat lock serializes concurrent runs in the same chat", async () => {
  const taskA = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "A",
    prompt: "pA",
    once: false,
  });
  const taskB = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "B",
    prompt: "pB",
    once: false,
  });
  opencodeClient.session.create
    .mockResolvedValueOnce({ data: { id: "eph-a" } })
    .mockResolvedValueOnce({ data: { id: "eph-b" } });
  opencodeClient.session.messages
    .mockResolvedValueOnce({
      data: [
        { info: { role: "assistant" }, parts: [{ type: "text", text: "A" }] },
      ],
    })
    .mockResolvedValueOnce({
      data: [
        { info: { role: "assistant" }, parts: [{ type: "text", text: "B" }] },
      ],
    });
  opencodeClient.session.status.mockResolvedValue({
    data: { "eph-a": { type: "idle" }, "eph-b": { type: "idle" } },
  });
  const firePromiseA = fireCron(taskA.id, "job-a");
  const firePromiseB = fireCron(taskB.id, "job-b");
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromiseA;
  await firePromiseB;
  expect(opencodeClient.session.create).toHaveBeenCalledTimes(2);
});

test("retention trims run records beyond the cap", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const baseTime = Date.now();
  for (let i = 0; i < 502; i++) {
    database
      .insert(scheduleRunTable)
      .values({
        id: `seed-${i}`,
        scheduleId: task.id,
        trigger: "cron",
        status: "silent",
        startedAt: new Date(baseTime + i * 1000),
      })
      .run();
  }
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = database
    .select()
    .from(scheduleRunTable)
    .where(eq(scheduleRunTable.scheduleId, task.id))
    .all();
  expect(runs.length).toBeLessThanOrEqual(500);
});

test("#waitForText breaks when session is idle and has no assistant text", async () => {
  opencodeClient.session.status.mockResolvedValueOnce({
    data: { [ephemeralSessionId]: { type: "idle" } },
  });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [
      {
        info: { role: "assistant" },
        parts: [{ type: "tool", id: "t1", tool: "bash", state: "done" }],
      },
    ],
  });
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("silent");
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
});

test("#waitForText aborts after sleep when signal fires mid-interval", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const jobId = "sleep-abort-job";
  const firePromise = fireCron(task.id, jobId);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  abortSignals.get(jobId)?.abort();
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("cancelled");
});

test("#waitForText aborts on signal before sleep in subsequent iterations", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.status.mockImplementationOnce(async () => {
    for (const [, ctrl] of abortSignals) ctrl.abort();
    throw new Error("trigger retry");
  });
  const firePromise = fireCron(task.id, "abort-iter");
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("cancelled");
});

test("#waitForText returns null when max attempts exhausted with no text", async () => {
  opencodeClient.session.status.mockResolvedValue({ data: {} });
  opencodeClient.session.messages.mockResolvedValue({
    data: [{ info: { role: "user" }, parts: [] }],
  });
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
    maxRuntimeMs: 4000,
  });
  const firePromise = fireCron(task.id);
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(0);
  }
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("silent");
});

test("#waitForText continues after a busy status", async () => {
  opencodeClient.session.status
    .mockResolvedValueOnce({ data: { [ephemeralSessionId]: { type: "busy" } } })
    .mockResolvedValueOnce({
      data: { [ephemeralSessionId]: { type: "idle" } },
    });
  opencodeClient.session.messages.mockResolvedValueOnce({
    data: [
      { info: { role: "assistant" }, parts: [{ type: "text", text: "yo" }] },
    ],
  });
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "yo", {});
});

test("#waitForText recovers from a poll error and retries", async () => {
  opencodeClient.session.status.mockRejectedValueOnce(new Error("transient"));
  mockAssistantText("recovered");
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "recovered", {});
});

test("#waitForText recovers from a hung status call (poll timeout)", async () => {
  opencodeClient.session.status.mockImplementationOnce(
    () => new Promise(() => {}),
  );
  mockAssistantText("after-timeout");
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  const firePromise = fireCron(task.id);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(0);
  await firePromise;
  expect(bot.api.sendMessage).toHaveBeenCalledWith(123, "after-timeout", {});
});

test("execution records cancelled when signal fires during polling", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.messages.mockImplementationOnce(async () => {
    for (const [, controller] of abortSignals) controller.abort();
    return {
      data: [
        { info: { role: "assistant" }, parts: [{ type: "text", text: "hi" }] },
      ],
    };
  });
  const firePromise = fireCron(task.id, "abort-mid");
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("cancelled");
  expect(runs[0]?.output).toBe("hi");
  expect(bot.api.sendMessage).not.toHaveBeenCalled();
});

test("execution aborts when signal is triggered before prompt", async () => {
  const task = await scheduler.create({
    chatId: 123,
    cron: "0 * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });
  opencodeClient.session.create.mockImplementationOnce(async () => {
    for (const [, controller] of abortSignals) controller.abort();
    return { data: { id: ephemeralSessionId } };
  });
  mockAssistantText("hello");
  const firePromise = fireCron(task.id, "abort-job");
  await advanceForExecution();
  await firePromise;
  const runs = scheduler.listRuns({ scheduleId: task.id });
  expect(runs[0]?.status).toBe("cancelled");
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
  expect(opencodeClient.session.abort).toHaveBeenCalledWith({
    sessionID: ephemeralSessionId,
  });
});

test("#recover finalizes stuck runs as failed with bot restart", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-recover",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-stuck",
      scheduleId: "sched-recover",
      trigger: "cron",
      status: "running",
      startedAt: new Date(Date.now() - 60_000),
    })
    .run();
  scheduler[Symbol.dispose]();
  const restored = await Scheduler.create(
    bot as never,
    database,
    opencodeClient as never,
    existingSessions as never,
  );
  const run = restored.getRun("run-stuck");
  expect(run.status).toBe("failed");
  expect(run.error).toBe("bot restart");
  restored[Symbol.dispose]();
});

test("#recover re-registers enabled schedules not yet in bunqueue", async () => {
  scheduler[Symbol.dispose]();
  const freshDb = Database.create();
  freshDb
    .insert(sessionTable)
    .values({ id: userSessionId, chatId: 123, threadId: 0 })
    .run();
  freshDb
    .insert(scheduleTable)
    .values({
      id: "sched-recover",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
      enabled: true,
    })
    .run();
  mockListCrons.mockResolvedValueOnce([]);
  mockUpsert.mockClear();
  const restored = await Scheduler.create(
    bot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );
  expect(mockUpsert).toHaveBeenCalledWith(
    "sched-recover",
    expect.any(Object),
    expect.any(Object),
  );
  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("#recover skips schedules already registered in bunqueue", async () => {
  scheduler[Symbol.dispose]();
  const freshDb = Database.create();
  freshDb
    .insert(sessionTable)
    .values({ id: userSessionId, chatId: 123, threadId: 0 })
    .run();
  freshDb
    .insert(scheduleTable)
    .values({
      id: "sched-exist",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
      enabled: true,
    })
    .run();
  mockListCrons.mockResolvedValueOnce([
    { id: "sched-exist", name: "sched-exist", next: 0 },
  ]);
  mockUpsert.mockClear();
  const restored = await Scheduler.create(
    bot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );
  expect(mockUpsert).not.toHaveBeenCalled();
  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("#recover skips disabled schedules", async () => {
  scheduler[Symbol.dispose]();
  const freshDb = Database.create();
  freshDb
    .insert(sessionTable)
    .values({ id: userSessionId, chatId: 123, threadId: 0 })
    .run();
  freshDb
    .insert(scheduleTable)
    .values({
      id: "sched-disabled",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
      enabled: false,
    })
    .run();
  mockListCrons.mockResolvedValueOnce([]);
  mockUpsert.mockClear();
  const restored = await Scheduler.create(
    bot as never,
    freshDb,
    opencodeClient as never,
    existingSessions as never,
  );
  expect(mockUpsert).not.toHaveBeenCalled();
  restored[Symbol.dispose]();
  freshDb[Symbol.dispose]();
});

test("bunqueue accessor exposes the underlying instance", () => {
  expect(scheduler.bunqueue).toBeDefined();
});

test("dispose closes bunqueue", () => {
  scheduler[Symbol.dispose]();
  expect(mockClose).toHaveBeenCalled();
});

test("dispose logs error when queue close fails", () => {
  mockClose.mockRejectedValueOnce(new Error("close failed"));
  scheduler[Symbol.dispose]();
  expect(mockClose).toHaveBeenCalled();
});

test("orphan reconciler marks running run failed when bunqueue job is gone", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-orphan",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-orphan",
      scheduleId: "sched-orphan",
      queueJobId: "gone-job",
      trigger: "manual",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockGetJob.mockImplementation((id: string) => {
    if (id === "gone-job") return Promise.resolve(null);
    return Promise.resolve({ id, name: id });
  });
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const run = scheduler.getRun("run-orphan");
  expect(run.status).toBe("failed");
  expect(run.error).toBe("orphaned");
  expect(run.finishedAt).not.toBeNull();
});

test("orphan reconciler also rescues pending run whose bunqueue job is gone", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-orphan-pending",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-orphan-pending",
      scheduleId: "sched-orphan-pending",
      queueJobId: "vanished-job",
      trigger: "manual",
      status: "pending",
      startedAt: new Date(),
    })
    .run();
  mockGetJob.mockImplementation((id: string) => {
    if (id === "vanished-job") return Promise.resolve(null);
    return Promise.resolve({ id, name: id });
  });
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const run = scheduler.getRun("run-orphan-pending");
  expect(run.status).toBe("failed");
  expect(run.error).toBe("orphaned");
});

test("orphan reconciler skips rows with null queueJobId", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-null",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-no-job",
      scheduleId: "sched-null",
      trigger: "manual",
      status: "pending",
      startedAt: new Date(),
    })
    .run();
  mockGetJob.mockClear();
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const run = scheduler.getRun("run-no-job");
  expect(run.status).toBe("pending");
  expect(mockGetJob).not.toHaveBeenCalled();
});

test("orphan reconciler leaves running run alone when job is still present", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-live",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-live",
      scheduleId: "sched-live",
      queueJobId: "live-job",
      trigger: "manual",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const run = scheduler.getRun("run-live");
  expect(run.status).toBe("running");
  expect(mockGetJob).toHaveBeenCalledWith("live-job");
});

test("orphan reconciliation errors are logged and do not stop the interval", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-boom",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-boom",
      scheduleId: "sched-boom",
      queueJobId: "boom-job",
      trigger: "manual",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockGetJob.mockRejectedValueOnce(new Error("lookup failed"));
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const runAfterFirst = scheduler.getRun("run-boom");
  expect(runAfterFirst.status).toBe("running");
  mockGetJob.mockImplementation(() => Promise.resolve(null));
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  const runAfterSecond = scheduler.getRun("run-boom");
  expect(runAfterSecond.status).toBe("failed");
  expect(runAfterSecond.error).toBe("orphaned");
});

test("dispose stops the reconcile interval", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-after-dispose",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "run-after-dispose",
      scheduleId: "sched-after-dispose",
      queueJobId: "any-job",
      trigger: "manual",
      status: "running",
      startedAt: new Date(),
    })
    .run();
  mockGetJob.mockClear();
  scheduler[Symbol.dispose]();
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(mockGetJob).not.toHaveBeenCalled();
});

test("registers an error handler on bunqueue", () => {
  expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  const handler = mockOn.mock.calls.find(
    (call: unknown[]) => call[0] === "error",
  )?.[1] as (error: Error) => void;
  handler(new Error("test"));
});

test("NotFoundError has correct shape", () => {
  const err = new Scheduler.NotFoundError("abc");
  expect(err).toBeInstanceOf(Error);
  expect(err).toBeInstanceOf(Scheduler.NotFoundError);
  expect(err.id).toBe("abc");
  expect(err.message).toBe("Scheduled task not found: abc");
});

test("RunNotFoundError has correct shape", () => {
  const err = new Scheduler.RunNotFoundError("r1");
  expect(err).toBeInstanceOf(Error);
  expect(err).toBeInstanceOf(Scheduler.RunNotFoundError);
  expect(err.id).toBe("r1");
});

test("RunNotCancellableError includes id and status", () => {
  const err = new Scheduler.RunNotCancellableError("r2", "failed");
  expect(err).toBeInstanceOf(Error);
  expect(err).toBeInstanceOf(Scheduler.RunNotCancellableError);
  expect(err.id).toBe("r2");
  expect(err.status).toBe("failed");
});

test("parseOverlap throws on unknown value via list() output", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "bad-overlap",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
      overlap: "invalid",
    })
    .run();
  expect(() => scheduler.get("bad-overlap")).toThrow(
    "Invalid overlap value: invalid",
  );
});

test("parseRunStatus throws on unknown status via getRun()", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-bad",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "bad-run",
      scheduleId: "sched-bad",
      trigger: "cron",
      status: "bogus",
      startedAt: new Date(),
    })
    .run();
  expect(() => scheduler.getRun("bad-run")).toThrow("Invalid run status");
});

test("parseRunTrigger throws on unknown trigger via getRun()", async () => {
  database
    .insert(scheduleTable)
    .values({
      id: "sched-bad2",
      chatId: 123,
      description: "d",
      prompt: "p",
      cron: "0 * * * *",
    })
    .run();
  database
    .insert(scheduleRunTable)
    .values({
      id: "bad-trigger-run",
      scheduleId: "sched-bad2",
      trigger: "webhook",
      status: "reported",
      startedAt: new Date(),
    })
    .run();
  expect(() => scheduler.getRun("bad-trigger-run")).toThrow(
    "Invalid run trigger",
  );
});
