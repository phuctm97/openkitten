import { afterEach, beforeEach, expect, type Mock, test, vi } from "vitest";
import { Scheduler } from "~/lib/scheduler";

// Bun.cron.parse is not yet in @types/bun — declare the subset we use so
// vi.spyOn can reference the property without TypeScript errors.
declare namespace Bun {
  namespace cron {
    function parse(expression: string, cursor?: Date): Date | null;
  }
}

// ---------------------------------------------------------------------------
// Mock Bunqueue from bunqueue/client
// ---------------------------------------------------------------------------

interface MockJob {
  id: string;
  data: unknown;
}

interface MockSchedulerInfo {
  id: string;
  name: string;
  pattern: string | undefined;
  next: number | null;
}

interface MockQueueInner {
  removeAsync: Mock<(id: string) => Promise<void>>;
}

interface MockBunqueueInstance {
  add: Mock<(name: string, data: unknown, opts?: unknown) => Promise<MockJob>>;
  cron: Mock<
    (
      id: string,
      pattern: string,
      data?: unknown,
    ) => Promise<MockSchedulerInfo | null>
  >;
  getJob: Mock<(id: string) => Promise<MockJob | null>>;
  listCrons: Mock<() => Promise<MockSchedulerInfo[]>>;
  removeCron: Mock<(id: string) => Promise<boolean>>;
  close: Mock<() => Promise<void>>;
  queue: MockQueueInner;
}

let mockBunqueueInstance: MockBunqueueInstance;
let capturedProcessor: ((job: MockJob) => Promise<void>) | undefined;

vi.mock("bunqueue/client", () => ({
  Bunqueue: class MockBunqueue {
    add = (a: string, b: unknown, c?: unknown) =>
      mockBunqueueInstance.add(a, b as never, c as never);
    cron = (a: string, b: string, c?: unknown) =>
      mockBunqueueInstance.cron(a, b, c as never);
    getJob = (a: string) => mockBunqueueInstance.getJob(a);
    listCrons = () => mockBunqueueInstance.listCrons();
    removeCron = (a: string) => mockBunqueueInstance.removeCron(a);
    close = () => mockBunqueueInstance.close();
    queue = {
      removeAsync: (a: string) => mockBunqueueInstance.queue.removeAsync(a),
    };
    constructor(
      _name: string,
      opts: { processor?: (job: MockJob) => Promise<void> },
    ) {
      if (opts.processor) capturedProcessor = opts.processor;
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock getSessionAgent
// ---------------------------------------------------------------------------

const mockGetSessionAgent = vi.fn<() => string | undefined>();

vi.mock("~/lib/get-session-agent", () => ({
  getSessionAgent: () => mockGetSessionAgent(),
}));

// ---------------------------------------------------------------------------
// Spy references
// ---------------------------------------------------------------------------

let cronParseSpy: Mock<(expression: string, cursor?: Date) => Date | null>;

// ---------------------------------------------------------------------------
// Test dependencies
// ---------------------------------------------------------------------------

let mockBot: {
  api: { sendMessage: ReturnType<typeof vi.fn> };
};
let opencodeClient: {
  session: { promptAsync: ReturnType<typeof vi.fn> };
};
let existingSessions: {
  find: ReturnType<typeof vi.fn>;
};
let scheduler: Scheduler;

function makeMockBunqueueInstance(): MockBunqueueInstance {
  return {
    add: vi.fn(),
    cron: vi.fn(),
    getJob: vi.fn(),
    listCrons: vi.fn(),
    removeCron: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    queue: {
      removeAsync: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();

  mockBunqueueInstance = makeMockBunqueueInstance();
  capturedProcessor = undefined;

  cronParseSpy = vi
    .spyOn(Bun.cron, "parse")
    .mockImplementation(() => new Date(Date.now() + 60_000));

  mockBot = { api: { sendMessage: vi.fn().mockResolvedValue(undefined) } };
  opencodeClient = {
    session: { promptAsync: vi.fn().mockResolvedValue({ data: undefined }) },
  };
  existingSessions = { find: vi.fn().mockResolvedValue("session-1") };
  mockGetSessionAgent.mockReturnValue(undefined);

  scheduler = Scheduler.create(
    mockBot as never,
    {} as never,
    opencodeClient as never,
    existingSessions as never,
    "/tmp/test-data",
  );
});

afterEach(() => {
  scheduler[Symbol.dispose]();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// create() — recurring
// ---------------------------------------------------------------------------

test("create() recurring uses queue.cron and returns task", async () => {
  const cronInfo: MockSchedulerInfo = {
    id: "cron-42",
    name: "hourly",
    pattern: "0 * * * *",
    next: Date.now() + 60_000,
  };
  mockBunqueueInstance.cron.mockResolvedValue(cronInfo);

  const task = await scheduler.create({
    type: "message",
    chatId: 1,
    threadId: undefined,
    cron: "0 * * * *",
    description: "hourly",
    prompt: "do something",
    once: false,
  });

  expect(mockBunqueueInstance.cron).toHaveBeenCalledWith(
    "hourly",
    "0 * * * *",
    {
      type: "message",
      chatId: 1,
      threadId: undefined,
      description: "hourly",
      prompt: "do something",
      cron: "0 * * * *",
      once: false,
    },
  );
  expect(task.id).toBe("cron-42");
  expect(task.type).toBe("message");
  expect(task.cron).toBe("0 * * * *");
  expect(task.description).toBe("hourly");
  expect(task.prompt).toBe("do something");
  expect(task.paused).toBe(false);
  expect(task.once).toBe(false);
  expect(task.nextRun).toBe(new Date(Date.now() + 60_000).toISOString());
});

test("create() recurring uses crypto.randomUUID when cron returns null", async () => {
  mockBunqueueInstance.cron.mockResolvedValue(null);

  const task = await scheduler.create({
    type: "prompt",
    chatId: 1,
    threadId: undefined,
    cron: "0 * * * *",
    description: "hourly",
    prompt: "do something",
    once: false,
  });

  expect(task.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
});

// ---------------------------------------------------------------------------
// create() — once
// ---------------------------------------------------------------------------

test("create() once uses queue.add with computed delay", async () => {
  const fakeNow = new Date("2026-04-07T00:00:00.000Z").getTime();
  vi.setSystemTime(fakeNow);
  const futureDate = new Date(fakeNow + 60_000);
  cronParseSpy.mockReturnValue(futureDate);

  const job: MockJob = { id: "job-abc", data: {} };
  mockBunqueueInstance.add.mockResolvedValue(job);

  const task = await scheduler.create({
    type: "message",
    chatId: 2,
    threadId: 5,
    cron: "* * * * *",
    description: "once task",
    prompt: "run once",
    once: true,
  });

  expect(mockBunqueueInstance.add).toHaveBeenCalledWith(
    "once task",
    {
      type: "message",
      chatId: 2,
      threadId: 5,
      description: "once task",
      prompt: "run once",
      cron: "* * * * *",
      once: true,
    },
    { delay: 60_000 },
  );
  expect(task.id).toBe("job-abc");
  expect(task.once).toBe(true);
  expect(task.nextRun).toBe(futureDate.toISOString());
});

test("create() once with delay=0 when Bun.cron.parse returns null", async () => {
  cronParseSpy.mockReturnValue(null);
  const job: MockJob = { id: "job-zero", data: {} };
  mockBunqueueInstance.add.mockResolvedValue(job);

  const task = await scheduler.create({
    type: "message",
    chatId: 1,
    threadId: undefined,
    cron: "invalid",
    description: "d",
    prompt: "p",
    once: true,
  });

  expect(mockBunqueueInstance.add).toHaveBeenCalledWith(
    "d",
    expect.objectContaining({ once: true }),
    { delay: 0 },
  );
  expect(task.nextRun).toBeNull();
});

test("create() once with delay=0 when Bun.cron.parse throws", async () => {
  cronParseSpy.mockImplementation(() => {
    throw new Error("bad cron");
  });
  const job: MockJob = { id: "job-err", data: {} };
  mockBunqueueInstance.add.mockResolvedValue(job);

  const task = await scheduler.create({
    type: "message",
    chatId: 1,
    threadId: undefined,
    cron: "broken",
    description: "d",
    prompt: "p",
    once: true,
  });

  expect(mockBunqueueInstance.add).toHaveBeenCalledWith(
    "d",
    expect.objectContaining({ once: true }),
    { delay: 0 },
  );
  expect(task.nextRun).toBeNull();
});

test("create() recurring returns null nextRun when Bun.cron.parse returns null", async () => {
  cronParseSpy.mockReturnValue(null);
  mockBunqueueInstance.cron.mockResolvedValue({
    id: "cron-1",
    name: "d",
    pattern: "* * * * *",
    next: null,
  });

  const task = await scheduler.create({
    type: "prompt",
    chatId: 1,
    threadId: undefined,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  expect(task.nextRun).toBeNull();
});

test("create() recurring returns null nextRun when Bun.cron.parse throws", async () => {
  cronParseSpy.mockImplementation(() => {
    throw new Error("bad cron");
  });
  mockBunqueueInstance.cron.mockResolvedValue({
    id: "cron-1",
    name: "d",
    pattern: "* * * * *",
    next: null,
  });

  const task = await scheduler.create({
    type: "prompt",
    chatId: 1,
    threadId: undefined,
    cron: "* * * * *",
    description: "d",
    prompt: "p",
    once: false,
  });

  expect(task.nextRun).toBeNull();
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

test("list() returns tasks from listCrons", async () => {
  const cronInfos: MockSchedulerInfo[] = [
    {
      id: "cron-1",
      name: "Task A",
      pattern: "0 * * * *",
      next: new Date("2026-04-07T01:00:00.000Z").getTime(),
    },
    {
      id: "cron-2",
      name: "Task B",
      pattern: "0 0 * * *",
      next: null,
    },
  ];
  mockBunqueueInstance.listCrons.mockResolvedValue(cronInfos);

  const tasks = await scheduler.list();

  expect(mockBunqueueInstance.listCrons).toHaveBeenCalledOnce();
  expect(tasks).toHaveLength(2);

  const taskA = tasks[0];
  expect(taskA?.id).toBe("cron-1");
  expect(taskA?.cron).toBe("0 * * * *");
  expect(taskA?.description).toBe("Task A");
  expect(taskA?.prompt).toBe("");
  expect(taskA?.paused).toBe(false);
  expect(taskA?.once).toBe(false);
  expect(taskA?.nextRun).toBe("2026-04-07T01:00:00.000Z");

  const taskB = tasks[1];
  expect(taskB?.nextRun).toBeNull();
});

test("list() handles cron with undefined pattern", async () => {
  const cronInfos: MockSchedulerInfo[] = [
    { id: "cron-x", name: "No Pattern", pattern: undefined, next: null },
  ];
  mockBunqueueInstance.listCrons.mockResolvedValue(cronInfos);

  const tasks = await scheduler.list();

  expect(tasks[0]?.cron).toBe("");
});

test("list() returns empty array when no crons exist", async () => {
  mockBunqueueInstance.listCrons.mockResolvedValue([]);

  const tasks = await scheduler.list();

  expect(tasks).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// delete()
// ---------------------------------------------------------------------------

test("delete() calls removeCron and returns when cron is removed", async () => {
  mockBunqueueInstance.removeCron.mockResolvedValue(true);

  await scheduler.delete("cron-123");

  expect(mockBunqueueInstance.removeCron).toHaveBeenCalledWith("cron-123");
  expect(mockBunqueueInstance.queue.removeAsync).not.toHaveBeenCalled();
});

test("delete() falls back to queue.removeAsync when removeCron returns false", async () => {
  mockBunqueueInstance.removeCron.mockResolvedValue(false);

  await scheduler.delete("job-456");

  expect(mockBunqueueInstance.removeCron).toHaveBeenCalledWith("job-456");
  expect(mockBunqueueInstance.queue.removeAsync).toHaveBeenCalledWith(
    "job-456",
  );
});

// ---------------------------------------------------------------------------
// trigger()
// ---------------------------------------------------------------------------

test("trigger() finds job and executes it via #execute", async () => {
  const jobData = {
    type: "prompt" as const,
    chatId: 1,
    threadId: undefined,
    description: "d",
    prompt: "run this",
    cron: "0 * * * *",
    once: false,
  };
  mockBunqueueInstance.getJob.mockResolvedValue({
    id: "job-1",
    data: jobData,
  });
  existingSessions.find.mockResolvedValue("session-1");
  mockGetSessionAgent.mockReturnValue(undefined);

  await scheduler.trigger("job-1");

  expect(mockBunqueueInstance.getJob).toHaveBeenCalledWith("job-1");
  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 1, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-1",
      parts: [{ type: "text", text: "[Scheduled Task] run this" }],
    }),
    { throwOnError: true },
  );
});

test("trigger() includes agent when getSessionAgent returns a value", async () => {
  const jobData = {
    type: "prompt" as const,
    chatId: 1,
    threadId: undefined,
    description: "d",
    prompt: "agent task",
    cron: "0 * * * *",
    once: false,
  };
  mockBunqueueInstance.getJob.mockResolvedValue({ id: "job-2", data: jobData });
  existingSessions.find.mockResolvedValue("session-2");
  mockGetSessionAgent.mockReturnValue("my-agent");

  await scheduler.trigger("job-2");

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-2",
      agent: "my-agent",
      parts: [{ type: "text", text: "[Scheduled Task] agent task" }],
    }),
    { throwOnError: true },
  );
});

test("trigger() throws NotFoundError when job is not found", async () => {
  mockBunqueueInstance.getJob.mockResolvedValue(null);

  await expect(scheduler.trigger("no-such-id")).rejects.toThrow(
    Scheduler.NotFoundError,
  );

  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
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
// [Symbol.dispose]()
// ---------------------------------------------------------------------------

test("[Symbol.dispose]() calls queue.close()", () => {
  scheduler[Symbol.dispose]();
  expect(mockBunqueueInstance.close).toHaveBeenCalledOnce();
});

test("[Symbol.dispose]() logs error when close() rejects", async () => {
  const closeError = new Error("close failed");
  mockBunqueueInstance.close.mockRejectedValue(closeError);

  // Should not throw synchronously
  expect(() => scheduler[Symbol.dispose]()).not.toThrow();

  // Allow the rejected promise to settle
  await vi.runAllTimersAsync();
});

// ---------------------------------------------------------------------------
// Processor callback (the one passed to new Bunqueue)
// ---------------------------------------------------------------------------

test("processor callback executes job via Scheduler.#instance", async () => {
  // Scheduler.create() was called in beforeEach, so capturedProcessor is set
  // and Scheduler.#instance is the created scheduler.
  expect(capturedProcessor).toBeDefined();

  const jobData = {
    type: "prompt" as const,
    chatId: 10,
    threadId: 3,
    description: "d",
    prompt: "from processor",
    cron: "* * * * *",
    once: false,
  };
  existingSessions.find.mockResolvedValue("session-proc");
  mockGetSessionAgent.mockReturnValue(undefined);

  await capturedProcessor?.({ id: "proc-job-1", data: jobData } as never);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 10, threadId: 3 },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "session-proc",
      parts: [{ type: "text", text: "[Scheduled Task] from processor" }],
    }),
    { throwOnError: true },
  );
});

test("processor callback logs error and rethrows when #execute throws", async () => {
  expect(capturedProcessor).toBeDefined();

  const jobData = {
    type: "prompt" as const,
    chatId: 1,
    threadId: undefined,
    description: "d",
    prompt: "fail",
    cron: "* * * * *",
    once: false,
  };

  const execError = new Error("execute failed");
  opencodeClient.session.promptAsync.mockRejectedValueOnce(execError);
  existingSessions.find.mockResolvedValue("session-1");

  await expect(
    capturedProcessor?.({ id: "proc-job-2", data: jobData } as never),
  ).rejects.toThrow(execError);
});

test("processor callback is a no-op when Scheduler.#instance is undefined (race before #instance is set)", async () => {
  // The `if (!instance)` guard fires if a job arrives between `new Bunqueue(...)` and
  // `Scheduler.#instance = scheduler`. We simulate this race by making the Bunqueue
  // constructor immediately invoke the processor synchronously before returning.
  // At that point in Scheduler.create(), #instance has not yet been assigned.

  vi.resetModules();

  let earlyProcessor: ((job: MockJob) => Promise<void>) | undefined;
  let earlyCallResult: string | undefined;

  vi.doMock("bunqueue/client", () => ({
    Bunqueue: class BunqueueEarly {
      add = vi.fn();
      cron = vi.fn();
      getJob = vi.fn();
      listCrons = vi.fn();
      removeCron = vi.fn();
      close = vi.fn(async () => {});
      queue = { removeAsync: vi.fn() };
      constructor(
        _name: string,
        opts: { processor: (job: MockJob) => Promise<void> },
      ) {
        earlyProcessor = opts.processor;
        void opts.processor({ id: "early-job", data: {} } as never).then(() => {
          earlyCallResult = "ran";
        });
      }
    },
  }));

  vi.doMock("~/lib/get-session-agent", () => ({
    getSessionAgent: () => mockGetSessionAgent(),
  }));

  const { Scheduler: FreshScheduler } = await import("~/lib/scheduler");

  const loggerModule = await import("~/lib/logger");
  const warnSpy = vi
    .spyOn(loggerModule.logger, "warn")
    .mockImplementation((() => loggerModule.logger) as never);

  FreshScheduler.create(
    {} as never,
    {} as never,
    opencodeClient as never,
    existingSessions as never,
    "/tmp/test-early",
  );

  // Let the immediately-invoked async processor settle
  await Promise.resolve();

  expect(earlyProcessor).toBeDefined();
  expect(earlyCallResult).toBe("ran");
  // The processor should have returned early after logging a warning, not called promptAsync
  expect(warnSpy).toHaveBeenCalledWith("Scheduler not ready, skipping job");
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();

  warnSpy.mockRestore();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// #execute — threadId propagation
// ---------------------------------------------------------------------------

test("#execute passes threadId correctly via trigger", async () => {
  const jobData = {
    type: "prompt" as const,
    chatId: 99,
    threadId: 7,
    description: "threaded",
    prompt: "thread prompt",
    cron: "* * * * *",
    once: false,
  };
  mockBunqueueInstance.getJob.mockResolvedValue({
    id: "job-thread",
    data: jobData,
  });
  existingSessions.find.mockResolvedValue("session-t");
  mockGetSessionAgent.mockReturnValue(undefined);

  await scheduler.trigger("job-thread");

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 99, threadId: 7 },
    { createIfNotFound: true },
  );
});

// ---------------------------------------------------------------------------
// #execute — type: "message" path
// ---------------------------------------------------------------------------

test('#execute calls bot.api.sendMessage for type "message" without threadId', async () => {
  const jobData = {
    type: "message" as const,
    chatId: 55,
    threadId: undefined,
    description: "msg task",
    prompt: "Hello world",
    cron: "* * * * *",
    once: false,
  };
  mockBunqueueInstance.getJob.mockResolvedValue({
    id: "job-msg-1",
    data: jobData,
  });

  await scheduler.trigger("job-msg-1");

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(55, "Hello world", {});
  expect(existingSessions.find).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test('#execute calls bot.api.sendMessage with message_thread_id for type "message" with threadId', async () => {
  const jobData = {
    type: "message" as const,
    chatId: 55,
    threadId: 42,
    description: "msg task with thread",
    prompt: "Hello thread",
    cron: "* * * * *",
    once: false,
  };
  mockBunqueueInstance.getJob.mockResolvedValue({
    id: "job-msg-2",
    data: jobData,
  });

  await scheduler.trigger("job-msg-2");

  expect(mockBot.api.sendMessage).toHaveBeenCalledWith(55, "Hello thread", {
    message_thread_id: 42,
  });
  expect(existingSessions.find).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});
