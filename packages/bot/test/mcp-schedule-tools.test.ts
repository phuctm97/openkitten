import { beforeEach, describe, expect, test, vi } from "vitest";
import { registerScheduleTools } from "~/lib/register-schedule-tools";
import type { Scheduler } from "~/lib/scheduler";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface RegisteredTool {
  config: unknown;
  handler: ToolHandler;
}

function makeRegisteredTools() {
  const registeredTools = new Map<string, RegisteredTool>();
  const mockServer = {
    registerTool: vi.fn(
      (name: string, config: unknown, handler: ToolHandler) => {
        registeredTools.set(name, { config, handler });
      },
    ),
  };
  return { registeredTools, mockServer };
}

function makeTask(overrides?: Partial<Scheduler.Task>): Scheduler.Task {
  return {
    id: "task-1",
    sessionId: "sess-1",
    kind: "session",
    cron: "0 * * * *",
    description: "Hourly task",
    prompt: "Do something",
    once: false,
    createdAt: 1712448000000,
    updatedAt: 1712448000000,
    lastTriggeredAt: null,
    nextRunAt: 1712451600000,
    lastRun: null,
    ...overrides,
  };
}

describe("registerScheduleTools", () => {
  const mockSchedulerCreate = vi.fn<() => Promise<Scheduler.Task>>();
  const mockSchedulerList = vi.fn<() => Scheduler.Task[]>();
  const mockSchedulerDelete = vi.fn<() => Promise<void>>();
  const mockSchedulerTrigger = vi.fn<() => Promise<Scheduler.TriggerResult>>();
  const mockSchedulerUpdate = vi.fn<() => Promise<Scheduler.Task>>();

  const mockBunqueue = {
    queue: {
      add: vi.fn().mockResolvedValue({
        id: "job-1",
        name: "job-1",
        data: {},
        delay: 0,
        priority: 0,
        timestamp: Date.now(),
        getState: vi.fn().mockResolvedValue("waiting"),
      }),
      getJobsAsync: vi.fn().mockResolvedValue([]),
      removeAsync: vi.fn().mockResolvedValue(undefined),
      retryJob: vi.fn().mockResolvedValue(undefined),
      cleanAsync: vi.fn().mockResolvedValue([]),
      promoteJob: vi.fn().mockResolvedValue(undefined),
    },
    getJobCountsAsync: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      prioritized: 0,
      paused: 0,
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    isPaused: vi.fn().mockReturnValue(false),
    getDlq: vi.fn().mockReturnValue([]),
    getDlqStats: vi.fn().mockReturnValue({
      total: 0,
      byReason: {},
      pendingRetry: 0,
      expired: 0,
      oldestEntry: null,
      newestEntry: null,
    }),
    retryDlq: vi.fn().mockReturnValue(0),
    purgeDlq: vi.fn().mockReturnValue(0),
    cancel: vi.fn(),
    getJob: vi.fn().mockResolvedValue(null),
    listCrons: vi.fn().mockResolvedValue([]),
  };

  const mockScheduler = {
    create: mockSchedulerCreate,
    list: mockSchedulerList,
    delete: mockSchedulerDelete,
    trigger: mockSchedulerTrigger,
    update: mockSchedulerUpdate,
    getRuns: vi.fn().mockReturnValue([]),
    addJob: vi.fn().mockResolvedValue({
      id: "job-1",
      name: "job-1",
      data: {},
      delay: 0,
      priority: 0,
      timestamp: Date.now(),
      toJSON: () => ({
        id: "job-1",
        name: "job-1",
        data: {},
        opts: {},
        progress: 0,
        delay: 0,
        timestamp: Date.now(),
        attemptsMade: 0,
        stacktrace: null,
        queueQualifiedName: "scheduler",
      }),
    }),
    bunqueue: mockBunqueue,
  } as never as Scheduler;

  const mockGetMetadata = vi.fn<(args: unknown) => { sessionID: string }>();

  const metadataArgs = { __OPENKITTEN__: { sessionID: "sess-1" } };

  beforeEach(() => {
    mockSchedulerCreate.mockClear();
    mockSchedulerList.mockClear();
    mockSchedulerDelete.mockClear();
    mockSchedulerTrigger.mockClear();
    mockSchedulerUpdate.mockClear();
    mockGetMetadata.mockClear();

    mockGetMetadata.mockReturnValue({ sessionID: "sess-1" });
  });

  function setup() {
    const { registeredTools, mockServer } = makeRegisteredTools();
    registerScheduleTools(mockServer as never, {
      scheduler: mockScheduler,
      getMetadata: mockGetMetadata,
    });
    return registeredTools;
  }

  test("registers all schedule and queue tools", () => {
    const tools = setup();
    expect(tools.size).toBe(22);
    expect([...tools.keys()]).toEqual([
      "queue_schedule_create",
      "queue_schedule_list",
      "queue_schedule_delete",
      "queue_schedule_trigger",
      "queue_schedule_update",
      "queue_schedule_runs",
      "queue_server_time",
      "queue_add_job",
      "queue_status",
      "queue_pause",
      "queue_resume",
      "queue_cancel_job",
      "queue_get_job",
      "queue_list_crons",
      "queue_dlq_list",
      "queue_dlq_retry",
      "queue_dlq_purge",
      "queue_list_jobs",
      "queue_remove_job",
      "queue_retry_job",
      "queue_clean",
      "queue_promote_job",
    ]);
  });

  describe("queue_schedule_create", () => {
    test("creates a recurring session task", async () => {
      const task = makeTask();
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      const args = {
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
      };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerCreate).toHaveBeenCalledWith({
        sessionId: "sess-1",
        kind: "session",
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
        once: false,
      });
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Hourly task"),
          },
        ],
        structuredContent: { ...task },
      });
    });

    test("shows N/A in content when nextRun is null", async () => {
      const task = makeTask({ nextRunAt: null });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
      })) as { content: { text: string }[] };

      expect(result.content[0]?.text).toContain("N/A");
    });

    test("creates a once task when once=true", async () => {
      const task = makeTask({ once: true });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      await tool.handler({
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
        once: true,
      });

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ once: true }),
      );
    });

    test("defaults once to false when omitted", async () => {
      mockSchedulerCreate.mockResolvedValue(makeTask());

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      await tool.handler({
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
      });

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ once: false }),
      );
    });

    test('passes kind "background" through to scheduler.create', async () => {
      const task = makeTask({ kind: "background" });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      await tool.handler({
        ...metadataArgs,
        kind: "background",
        cron: "@daily",
        description: "BG task",
        prompt: "Check status",
      });

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "background" }),
      );
    });

    test('defaults kind to "session" when omitted', async () => {
      mockSchedulerCreate.mockResolvedValue(makeTask());

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      await tool.handler({
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
      });

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "session" }),
      );
    });

    test("propagates scheduler.create errors", async () => {
      const error = new Error("create failed");
      mockSchedulerCreate.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("queue_schedule_create");
      if (!tool) throw new Error("queue_schedule_create not registered");

      await expect(
        tool.handler({
          ...metadataArgs,
          cron: "0 * * * *",
          description: "d",
          prompt: "p",
        }),
      ).rejects.toBe(error);
    });
  });

  describe("queue_schedule_list", () => {
    test("lists tasks and returns them", async () => {
      const tasks = [
        makeTask(),
        makeTask({ id: "task-2", description: "Second" }),
      ];
      mockSchedulerList.mockReturnValue(tasks);

      const tools = setup();
      const tool = tools.get("queue_schedule_list");
      if (!tool) throw new Error("queue_schedule_list not registered");

      const args = { ...metadataArgs };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerList).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("2 scheduled task(s)"),
          },
        ],
        structuredContent: { tasks: tasks.map((t) => ({ ...t })) },
      });
    });

    test("list content shows N/A for null nextRun", async () => {
      mockSchedulerList.mockReturnValue([makeTask({ nextRunAt: null })]);

      const tools = setup();
      const tool = tools.get("queue_schedule_list");
      if (!tool) throw new Error("queue_schedule_list not registered");

      const result = (await tool.handler({ ...metadataArgs })) as {
        content: { text: string }[];
      };

      expect(result.content[0]?.text).toContain("N/A");
    });

    test("returns empty list when no tasks", async () => {
      mockSchedulerList.mockReturnValue([]);

      const tools = setup();
      const tool = tools.get("queue_schedule_list");
      if (!tool) throw new Error("queue_schedule_list not registered");

      const result = await tool.handler({ ...metadataArgs });

      expect(result).toEqual({
        content: [{ type: "text", text: "No scheduled tasks." }],
        structuredContent: { tasks: [] },
      });
    });
  });

  describe("queue_schedule_delete", () => {
    test("deletes a task and returns deleted: true", async () => {
      mockSchedulerDelete.mockResolvedValue(undefined);

      const tools = setup();
      const tool = tools.get("queue_schedule_delete");
      if (!tool) throw new Error("queue_schedule_delete not registered");

      const args = { ...metadataArgs, id: "task-1" };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerDelete).toHaveBeenCalledWith("task-1");
      expect(result).toEqual({
        content: [{ type: "text", text: "Deleted schedule task-1." }],
        structuredContent: { deleted: true },
      });
    });

    test("propagates scheduler.delete errors", async () => {
      const error = new Error("not found");
      mockSchedulerDelete.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("queue_schedule_delete");
      if (!tool) throw new Error("queue_schedule_delete not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing" }),
      ).rejects.toBe(error);
    });
  });

  describe("queue_schedule_trigger", () => {
    test("triggers a task and returns scheduleId and jobId", async () => {
      mockSchedulerTrigger.mockResolvedValue({
        scheduleId: "task-1",
        jobId: "job-99",
        enqueuedAt: 1712448000000,
      });

      const tools = setup();
      const tool = tools.get("queue_schedule_trigger");
      if (!tool) throw new Error("queue_schedule_trigger not registered");

      const args = { ...metadataArgs, id: "task-1" };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerTrigger).toHaveBeenCalledWith("task-1");
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Triggered schedule task-1 → job job-99",
          },
        ],
        structuredContent: {
          scheduleId: "task-1",
          jobId: "job-99",
          enqueuedAt: 1712448000000,
        },
      });
    });

    test("propagates scheduler.trigger errors", async () => {
      const error = new Error("not found");
      mockSchedulerTrigger.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("queue_schedule_trigger");
      if (!tool) throw new Error("queue_schedule_trigger not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing" }),
      ).rejects.toBe(error);
    });
  });

  describe("queue_schedule_update", () => {
    test("updates task and returns updated result", async () => {
      const updated = makeTask({ description: "Updated" });
      mockSchedulerUpdate.mockResolvedValue(updated);

      const tools = setup();
      const tool = tools.get("queue_schedule_update");
      if (!tool) throw new Error("queue_schedule_update not registered");

      const args = {
        ...metadataArgs,
        id: "task-1",
        description: "Updated",
      };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerUpdate).toHaveBeenCalledWith("task-1", {
        description: "Updated",
      });
      expect(result).toEqual({
        content: [{ type: "text", text: expect.stringContaining("Updated") }],
        structuredContent: { ...updated },
      });
    });

    test("update content shows N/A for null nextRun", async () => {
      const updated = makeTask({ nextRunAt: null });
      mockSchedulerUpdate.mockResolvedValue(updated);

      const tools = setup();
      const tool = tools.get("queue_schedule_update");
      if (!tool) throw new Error("queue_schedule_update not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        id: "task-1",
        prompt: "new",
      })) as { content: { text: string }[] };

      expect(result.content[0]?.text).toContain("N/A");
    });

    test("updates cron only", async () => {
      const updated = makeTask({ cron: "@daily" });
      mockSchedulerUpdate.mockResolvedValue(updated);

      const tools = setup();
      const tool = tools.get("queue_schedule_update");
      if (!tool) throw new Error("queue_schedule_update not registered");

      await tool.handler({
        ...metadataArgs,
        id: "task-1",
        cron: "@daily",
      });

      expect(mockSchedulerUpdate).toHaveBeenCalledWith("task-1", {
        cron: "@daily",
      });
    });

    test("propagates scheduler.update errors", async () => {
      const error = new Error("not found");
      mockSchedulerUpdate.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("queue_schedule_update");
      if (!tool) throw new Error("queue_schedule_update not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing", prompt: "x" }),
      ).rejects.toBe(error);
    });
  });

  describe("queue_schedule_runs", () => {
    test("returns empty run history", async () => {
      const tools = setup();
      const tool = tools.get("queue_schedule_runs");
      if (!tool) throw new Error("queue_schedule_runs not registered");

      const result = await tool.handler({ ...metadataArgs, id: "task-1" });

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("structuredContent");
    });

    test("returns run history with entries", async () => {
      (mockScheduler.getRuns as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        {
          jobId: "j-1",
          startedAt: 1712448000000,
          finishedAt: 1712448060000,
          status: "completed_notified",
          notifiedUser: true,
          output: "Important report data",
          error: null,
        },
        {
          jobId: "j-2",
          startedAt: 1712448060000,
          finishedAt: 1712448120000,
          status: "failed",
          notifiedUser: false,
          output: null,
          error: "timeout",
        },
      ]);

      const tools = setup();
      const tool = tools.get("queue_schedule_runs");
      if (!tool) throw new Error("queue_schedule_runs not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        id: "task-1",
      })) as { content: { text: string }[] };

      expect(result.content[0]?.text).toContain("completed_notified");
      expect(result.content[0]?.text).toContain(
        "output: Important report data",
      );
      expect(result.content[0]?.text).toContain("error: timeout");
    });
  });

  describe("queue_server_time", () => {
    test("returns current server time with all fields", async () => {
      const tools = setup();
      const tool = tools.get("queue_server_time");
      if (!tool) throw new Error("queue_server_time not registered");

      const result = (await tool.handler({})) as {
        structuredContent: Record<string, unknown>;
        content: { type: string; text: string }[];
      };
      const sc = result.structuredContent as {
        iso: string;
        unix: number;
        utc: string;
        timezone: string;
        offset: number;
      };

      expect(sc.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(sc.unix).toBeTypeOf("number");
      expect(sc.utc).toBeTypeOf("string");
      expect(sc.timezone).toBeTypeOf("string");
      expect((sc.timezone as string).length).toBeGreaterThan(0);
      expect(sc.offset).toBeTypeOf("number");
      expect(result.content).toEqual([
        { type: "text", text: expect.stringContaining("Server time:") },
      ]);
    });
  });

  describe("getMetadata verification", () => {
    test.each([
      "queue_schedule_create",
      "queue_schedule_list",
      "queue_schedule_delete",
      "queue_schedule_trigger",
      "queue_schedule_update",
    ] as const)("%s calls getMetadata with the full args object", async (toolName) => {
      mockSchedulerCreate.mockResolvedValue(makeTask());
      mockSchedulerList.mockReturnValue([]);
      mockSchedulerDelete.mockResolvedValue(undefined);
      mockSchedulerTrigger.mockResolvedValue({
        scheduleId: "task-1",
        jobId: "job-1",
        enqueuedAt: Date.now(),
      });
      mockSchedulerUpdate.mockResolvedValue(makeTask());

      const tools = setup();
      const tool = tools.get(toolName);
      if (!tool) throw new Error(`${toolName} not registered`);

      const args = {
        ...metadataArgs,
        id: "task-1",
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
      };
      await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
    });
  });

  // -------------------------------------------------------------------------
  // Queue tools (bunqueue pass-through)
  // -------------------------------------------------------------------------

  describe("queue_add_job", () => {
    test("calls scheduler.addJob and returns toJSON result", async () => {
      const tools = setup();
      const tool = tools.get("queue_add_job");
      if (!tool) throw new Error("queue_add_job not registered");

      const result = await tool.handler({
        ...metadataArgs,
        description: "one-off",
        prompt: "do it",
      });

      expect(result).toHaveProperty("content");
      expect(mockScheduler.addJob).toHaveBeenCalledWith(
        "sess-1",
        "session",
        "one-off",
        "do it",
        undefined,
      );
    });

    test("passes all JobOptions through to addJob", async () => {
      const tools = setup();
      const tool = tools.get("queue_add_job");
      if (!tool) throw new Error("queue_add_job not registered");

      await tool.handler({
        ...metadataArgs,
        kind: "background",
        description: "full opts",
        prompt: "run",
        priority: 10,
        delay: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        timeout: 30000,
        jobId: "custom-id",
        removeOnComplete: true,
        removeOnFail: true,
        lifo: true,
        stallTimeout: 60000,
        durable: true,
      });

      expect(mockScheduler.addJob).toHaveBeenCalledWith(
        "sess-1",
        "background",
        "full opts",
        "run",
        {
          priority: 10,
          delay: 5000,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          timeout: 30000,
          jobId: "custom-id",
          removeOnComplete: true,
          removeOnFail: true,
          lifo: true,
          stallTimeout: 60000,
          durable: true,
        },
      );
    });
  });

  describe("queue_status", () => {
    test("returns counts and paused state", async () => {
      const tools = setup();
      const tool = tools.get("queue_status");
      if (!tool) throw new Error("queue_status not registered");

      const result = await tool.handler(metadataArgs);

      expect(result).toHaveProperty("content");
      expect(mockBunqueue.getJobCountsAsync).toHaveBeenCalled();
      expect(mockBunqueue.isPaused).toHaveBeenCalled();
    });
  });

  describe("queue_pause", () => {
    test("pauses the queue", async () => {
      const tools = setup();
      const tool = tools.get("queue_pause");
      if (!tool) throw new Error("queue_pause not registered");

      await tool.handler(metadataArgs);

      expect(mockBunqueue.pause).toHaveBeenCalled();
    });
  });

  describe("queue_resume", () => {
    test("resumes the queue", async () => {
      const tools = setup();
      const tool = tools.get("queue_resume");
      if (!tool) throw new Error("queue_resume not registered");

      await tool.handler(metadataArgs);

      expect(mockBunqueue.resume).toHaveBeenCalled();
    });
  });

  describe("queue_cancel_job", () => {
    test("cancels a job by ID", async () => {
      const tools = setup();
      const tool = tools.get("queue_cancel_job");
      if (!tool) throw new Error("queue_cancel_job not registered");

      await tool.handler({ ...metadataArgs, jobId: "j-1" });

      expect(mockBunqueue.cancel).toHaveBeenCalledWith("j-1", undefined);
    });
  });

  describe("queue_get_job", () => {
    test("returns not found when job does not exist", async () => {
      const tools = setup();
      const tool = tools.get("queue_get_job");
      if (!tool) throw new Error("queue_get_job not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        jobId: "missing",
      })) as { content: { text: string }[] };

      expect(result.content[0]?.text).toContain("not found");
    });

    test("returns job details when found", async () => {
      mockBunqueue.getJob.mockResolvedValueOnce({
        id: "j-1",
        name: "j-1",
        data: { prompt: "test" },
        delay: 0,
        priority: 5,
        timestamp: 12345,
        attemptsMade: 0,
        progress: 0,
        failedReason: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        getState: vi.fn().mockResolvedValue("active"),
        toJSON: () => ({
          id: "j-1",
          name: "j-1",
          data: { prompt: "test" },
          opts: {},
          progress: 0,
          delay: 0,
          timestamp: 12345,
          attemptsMade: 0,
          stacktrace: null,
          queueQualifiedName: "scheduler",
        }),
      });

      const tools = setup();
      const tool = tools.get("queue_get_job");
      if (!tool) throw new Error("queue_get_job not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        jobId: "j-1",
      })) as { content: { text: string }[] };

      expect(result.content[0]?.text).toContain("j-1");
    });
  });

  describe("queue_list_crons", () => {
    test("returns cron list", async () => {
      mockBunqueue.listCrons.mockResolvedValueOnce([
        { id: "c-1", name: "c-1", next: 99999 },
      ]);

      const tools = setup();
      const tool = tools.get("queue_list_crons");
      if (!tool) throw new Error("queue_list_crons not registered");

      const result = await tool.handler(metadataArgs);

      expect(result).toHaveProperty("content");
      expect(mockBunqueue.listCrons).toHaveBeenCalled();
    });
  });

  describe("queue_dlq_list", () => {
    test("returns DLQ stats and entries without filter", async () => {
      const tools = setup();
      const tool = tools.get("queue_dlq_list");
      if (!tool) throw new Error("queue_dlq_list not registered");

      const result = await tool.handler(metadataArgs);

      expect(result).toHaveProperty("content");
      expect(mockBunqueue.getDlqStats).toHaveBeenCalled();
      expect(mockBunqueue.getDlq).toHaveBeenCalledWith();
    });

    test("passes filter to getDlq when provided", async () => {
      const tools = setup();
      const tool = tools.get("queue_dlq_list");
      if (!tool) throw new Error("queue_dlq_list not registered");

      await tool.handler({
        ...metadataArgs,
        reason: "timeout",
        olderThan: 1000,
        newerThan: 500,
        retriable: true,
        expired: false,
        limit: 10,
        offset: 5,
      });

      expect(mockBunqueue.getDlq).toHaveBeenCalledWith({
        reason: "timeout",
        olderThan: 1000,
        newerThan: 500,
        retriable: true,
        expired: false,
        limit: 10,
        offset: 5,
      });
    });

    test("serializes DlqEntry.job via toJSON()", async () => {
      const mockToJSON = vi.fn().mockReturnValue({ id: "j-1", name: "j-1" });
      mockBunqueue.getDlq.mockReturnValueOnce([
        {
          job: { id: "j-1", toJSON: mockToJSON },
          enteredAt: 1000,
          reason: "timeout",
          error: null,
          attempts: [],
          retryCount: 0,
          lastRetryAt: null,
          nextRetryAt: null,
          expiresAt: null,
        },
      ]);

      const tools = setup();
      const tool = tools.get("queue_dlq_list");
      if (!tool) throw new Error("queue_dlq_list not registered");

      await tool.handler(metadataArgs);

      expect(mockToJSON).toHaveBeenCalled();
    });
  });

  describe("queue_dlq_retry", () => {
    test("retries DLQ entries", async () => {
      mockBunqueue.retryDlq.mockReturnValue(2);

      const tools = setup();
      const tool = tools.get("queue_dlq_retry");
      if (!tool) throw new Error("queue_dlq_retry not registered");

      const result = (await tool.handler(metadataArgs)) as {
        content: { text: string }[];
      };

      expect(result.content[0]?.text).toContain("2");
      expect(mockBunqueue.retryDlq).toHaveBeenCalled();
    });
  });

  describe("queue_dlq_purge", () => {
    test("purges DLQ entries", async () => {
      mockBunqueue.purgeDlq.mockReturnValue(3);

      const tools = setup();
      const tool = tools.get("queue_dlq_purge");
      if (!tool) throw new Error("queue_dlq_purge not registered");

      const result = (await tool.handler(metadataArgs)) as {
        content: { text: string }[];
      };

      expect(result.content[0]?.text).toContain("3");
      expect(mockBunqueue.purgeDlq).toHaveBeenCalled();
    });
  });

  describe("queue_list_jobs", () => {
    test("lists jobs by state", async () => {
      mockBunqueue.queue.getJobsAsync.mockResolvedValueOnce([
        {
          id: "j-1",
          toJSON: () => ({ id: "j-1", name: "j-1", data: {} }),
        },
      ]);

      const tools = setup();
      const tool = tools.get("queue_list_jobs");
      if (!tool) throw new Error("queue_list_jobs not registered");

      const result = await tool.handler({
        ...metadataArgs,
        state: "waiting",
      });

      expect(result).toHaveProperty("content");
      expect(mockBunqueue.queue.getJobsAsync).toHaveBeenCalledWith({
        state: "waiting",
        start: undefined,
        end: undefined,
        asc: undefined,
      });
    });

    test("lists all jobs when no state specified", async () => {
      mockBunqueue.queue.getJobsAsync.mockResolvedValueOnce([]);

      const tools = setup();
      const tool = tools.get("queue_list_jobs");
      if (!tool) throw new Error("queue_list_jobs not registered");

      await tool.handler(metadataArgs);

      expect(mockBunqueue.queue.getJobsAsync).toHaveBeenCalledWith({});
    });

    test("passes all pagination params", async () => {
      mockBunqueue.queue.getJobsAsync.mockResolvedValueOnce([]);

      const tools = setup();
      const tool = tools.get("queue_list_jobs");
      if (!tool) throw new Error("queue_list_jobs not registered");

      await tool.handler({
        ...metadataArgs,
        state: "failed",
        start: 0,
        end: 10,
        asc: true,
      });

      expect(mockBunqueue.queue.getJobsAsync).toHaveBeenCalledWith({
        state: "failed",
        start: 0,
        end: 10,
        asc: true,
      });
    });
  });

  describe("queue_remove_job", () => {
    test("removes a job by ID", async () => {
      const tools = setup();
      const tool = tools.get("queue_remove_job");
      if (!tool) throw new Error("queue_remove_job not registered");

      await tool.handler({ ...metadataArgs, jobId: "j-1" });

      expect(mockBunqueue.queue.removeAsync).toHaveBeenCalledWith("j-1");
    });
  });

  describe("queue_retry_job", () => {
    test("retries a failed job", async () => {
      const tools = setup();
      const tool = tools.get("queue_retry_job");
      if (!tool) throw new Error("queue_retry_job not registered");

      await tool.handler({ ...metadataArgs, jobId: "j-1" });

      expect(mockBunqueue.queue.retryJob).toHaveBeenCalledWith("j-1");
    });
  });

  describe("queue_clean", () => {
    test("cleans old jobs by state", async () => {
      mockBunqueue.queue.cleanAsync.mockResolvedValueOnce(["j-1", "j-2"]);

      const tools = setup();
      const tool = tools.get("queue_clean");
      if (!tool) throw new Error("queue_clean not registered");

      const result = (await tool.handler({
        ...metadataArgs,
        grace: 60000,
        limit: 100,
        state: "completed",
      })) as { content: { text: string }[] };

      expect(mockBunqueue.queue.cleanAsync).toHaveBeenCalledWith(
        60000,
        100,
        "completed",
      );
      expect(result.content[0]?.text).toContain("j-1");
    });
  });

  describe("queue_promote_job", () => {
    test("promotes a delayed job", async () => {
      const tools = setup();
      const tool = tools.get("queue_promote_job");
      if (!tool) throw new Error("queue_promote_job not registered");

      await tool.handler({ ...metadataArgs, jobId: "j-1" });

      expect(mockBunqueue.queue.promoteJob).toHaveBeenCalledWith("j-1");
    });
  });
});
