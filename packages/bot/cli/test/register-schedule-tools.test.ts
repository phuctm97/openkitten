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
    chatId: 123,
    threadId: 0,
    cron: "0 * * * *",
    timezone: "UTC",
    description: "Hourly",
    prompt: "do it",
    once: false,
    enabled: true,
    overlap: "queue",
    notifyOnFailure: false,
    maxRuntimeMs: null,
    sessionId: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeRun(overrides?: Partial<Scheduler.Run>): Scheduler.Run {
  return {
    id: "run-1",
    scheduleId: "task-1",
    runSessionId: "run-sess-1",
    queueJobId: "job-1",
    trigger: "cron",
    status: "reported",
    startedAt: 1000,
    finishedAt: 2000,
    output: "hello",
    error: null,
    ...overrides,
  };
}

const metadata = { sessionID: "sess-1", callID: "call-1" };
const rawMetadataArg = { __OPENKITTEN__: metadata };

describe("registerScheduleTools", () => {
  const mockCreate = vi.fn<() => Promise<Scheduler.Task>>();
  const mockList = vi.fn<() => Scheduler.Task[]>();
  const mockGet = vi.fn<() => Scheduler.Task>();
  const mockUpdate = vi.fn<() => Promise<Scheduler.Task>>();
  const mockDelete = vi.fn<() => Promise<void>>();
  const mockEnable = vi.fn<() => Promise<Scheduler.Task>>();
  const mockDisable = vi.fn<() => Promise<Scheduler.Task>>();
  const mockTrigger = vi.fn<() => Promise<Scheduler.TriggerResult>>();
  const mockListRuns = vi.fn<() => Scheduler.Run[]>();
  const mockGetRun = vi.fn<() => Scheduler.Run>();
  const mockCancelRun = vi.fn<() => Promise<Scheduler.Run>>();

  const mockBunqueue = {
    queue: {
      getJobsAsync: vi
        .fn()
        .mockResolvedValue([
          { toJSON: () => ({ id: "j-1", state: "waiting" }) },
        ]),
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
    isPaused: vi.fn().mockReturnValue(false),
    listCrons: vi.fn().mockResolvedValue([]),
  };

  const scheduler = {
    create: mockCreate,
    list: mockList,
    get: mockGet,
    update: mockUpdate,
    delete: mockDelete,
    enable: mockEnable,
    disable: mockDisable,
    trigger: mockTrigger,
    listRuns: mockListRuns,
    getRun: mockGetRun,
    cancelRun: mockCancelRun,
    bunqueue: mockBunqueue,
  } as never as Scheduler;

  const getMetadata = vi.fn(() => metadata);

  beforeEach(() => {
    mockCreate.mockReset();
    mockList.mockReset();
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockEnable.mockReset();
    mockDisable.mockReset();
    mockTrigger.mockReset();
    mockListRuns.mockReset();
    mockGetRun.mockReset();
    mockCancelRun.mockReset();
    getMetadata.mockClear();
  });

  const existingSessions = {
    get: vi.fn<() => { chatId: number; threadId: number | undefined }>(() => ({
      chatId: 123,
      threadId: 456,
    })),
  };

  function setup() {
    const { registeredTools, mockServer } = makeRegisteredTools();
    registerScheduleTools(mockServer as never, {
      scheduler,
      existingSessions: existingSessions as never,
      getMetadata,
    });
    existingSessions.get.mockClear();
    return registeredTools;
  }

  test("registers all expected tools", () => {
    const tools = setup();
    const names = [
      "queue_server_time",
      "queue_schedule_create",
      "queue_schedule_list",
      "queue_schedule_update",
      "queue_schedule_delete",
      "queue_schedule_enable",
      "queue_schedule_disable",
      "queue_schedule_trigger",
      "queue_runs",
      "queue_run_get",
      "queue_run_cancel",
      "queue_status",
      "queue_list_jobs",
      "queue_list_crons",
    ];
    for (const name of names) expect(tools.has(name)).toBe(true);
  });

  test("queue_server_time returns iso, unix, utc, timezone, offset", async () => {
    const tools = setup();
    const tool = tools.get("queue_server_time");
    const result = (await tool?.handler(rawMetadataArg)) as {
      structuredContent: Record<string, unknown>;
    };
    expect(result.structuredContent).toHaveProperty("iso");
    expect(result.structuredContent).toHaveProperty("unix");
    expect(result.structuredContent).toHaveProperty("utc");
    expect(result.structuredContent).toHaveProperty("timezone");
  });

  test("queue_schedule_create forwards all optional fields", async () => {
    mockCreate.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_create")?.handler({
      ...rawMetadataArg,
      cron: "0 9 * * *",
      description: "d",
      prompt: "p",
      once: true,
      timezone: "Europe/London",
      overlap: "skip",
      notifyOnFailure: true,
      maxRuntimeMs: 30000,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      chatId: 123,
      threadId: 456,
      cron: "0 9 * * *",
      description: "d",
      prompt: "p",
      once: true,
      timezone: "Europe/London",
      overlap: "skip",
      notifyOnFailure: true,
      maxRuntimeMs: 30000,
    });
  });

  test("queue_schedule_create response text notes once tasks", async () => {
    mockCreate.mockResolvedValue(makeTask({ once: true }));
    const tools = setup();
    const result = (await tools.get("queue_schedule_create")?.handler({
      ...rawMetadataArg,
      cron: "0 9 * * *",
      description: "Once",
      prompt: "p",
      once: true,
    })) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain(", once");
  });

  test("queue_schedule_list response text marks once and notifyOnFailure", async () => {
    mockList.mockReturnValue([
      makeTask({ once: true, notifyOnFailure: true, enabled: false }),
    ]);
    const tools = setup();
    const result = (await tools
      .get("queue_schedule_list")
      ?.handler(rawMetadataArg)) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("(once)");
    expect(result.content[0]?.text).toContain("notifyOnFailure");
    expect(result.content[0]?.text).toContain("⏸");
  });

  test("queue_schedule_create defaults once to false", async () => {
    mockCreate.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_create")?.handler({
      ...rawMetadataArg,
      cron: "0 9 * * *",
      description: "d",
      prompt: "p",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ once: false }),
    );
  });

  test("queue_schedule_create forwards sessionId for session-bound schedules", async () => {
    mockCreate.mockResolvedValue(makeTask({ sessionId: "opencode-sess-7" }));
    const tools = setup();
    await tools.get("queue_schedule_create")?.handler({
      ...rawMetadataArg,
      cron: "0 * * * *",
      description: "d",
      prompt: "p",
      sessionId: "opencode-sess-7",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "opencode-sess-7" }),
    );
  });

  test("queue_schedule_update forwards a new sessionId to rebind the schedule", async () => {
    mockUpdate.mockResolvedValue(makeTask({ sessionId: "opencode-sess-9" }));
    const tools = setup();
    await tools.get("queue_schedule_update")?.handler({
      ...rawMetadataArg,
      id: "00000000-0000-0000-0000-000000000000",
      sessionId: "opencode-sess-9",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000000",
      { sessionId: "opencode-sess-9" },
    );
  });

  test("queue_schedule_update accepts null sessionId to unbind a schedule", async () => {
    mockUpdate.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_update")?.handler({
      ...rawMetadataArg,
      id: "00000000-0000-0000-0000-000000000000",
      sessionId: null,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000000",
      { sessionId: null },
    );
  });

  test("queue_schedule_create input schema rejects non-ses_ sessionId values", () => {
    const tools = setup();
    const config = tools.get("queue_schedule_create")?.config as {
      inputSchema: { safeParse: (value: unknown) => { success: boolean } };
    };
    const base = {
      cron: "0 * * * *",
      description: "d",
      prompt: "p",
      once: false,
    };
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: ".__OMIT__" }).success,
    ).toBe(false);
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: "none" }).success,
    ).toBe(false);
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: "" }).success,
    ).toBe(false);
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: "ses_abc123" })
        .success,
    ).toBe(true);
    expect(config.inputSchema.safeParse(base).success).toBe(true);
  });

  test("queue_schedule_update input schema rejects non-ses_ sessionId values but allows null", () => {
    const tools = setup();
    const config = tools.get("queue_schedule_update")?.config as {
      inputSchema: { safeParse: (value: unknown) => { success: boolean } };
    };
    const base = { id: "00000000-0000-0000-0000-000000000000" };
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: ".__OMIT__" }).success,
    ).toBe(false);
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: "placeholder" })
        .success,
    ).toBe(false);
    expect(
      config.inputSchema.safeParse({ ...base, sessionId: null }).success,
    ).toBe(true);
    expect(
      config.inputSchema.safeParse({
        ...base,
        sessionId: "ses_245b9c1f2ffey2EnwnQ9TxuF87",
      }).success,
    ).toBe(true);
  });

  test("queue_schedule_list returns filtered tasks", async () => {
    mockList.mockReturnValue([makeTask({ description: "Alpha" })]);
    const tools = setup();
    const result = (await tools.get("queue_schedule_list")?.handler({
      ...rawMetadataArg,
      enabled: true,
    })) as { structuredContent: { tasks: unknown[] } };
    expect(mockList).toHaveBeenCalledWith({
      chatId: 123,
      threadId: 456,
      enabled: true,
    });
    expect(result.structuredContent.tasks).toHaveLength(1);
  });

  test("queue_schedule_list scopes to caller chat without enabled filter", async () => {
    mockList.mockReturnValue([]);
    const tools = setup();
    await tools.get("queue_schedule_list")?.handler(rawMetadataArg);
    expect(mockList).toHaveBeenCalledWith({
      chatId: 123,
      threadId: 456,
    });
  });

  test("queue_schedule_list defaults threadId to 0 when caller has no thread", async () => {
    existingSessions.get.mockReturnValueOnce({
      chatId: 123,
      threadId: undefined,
    });
    mockList.mockReturnValue([]);
    const tools = setup();
    await tools.get("queue_schedule_list")?.handler(rawMetadataArg);
    expect(mockList).toHaveBeenCalledWith({
      chatId: 123,
      threadId: 0,
    });
  });

  test("queue_schedule_list with no tasks returns friendly text", async () => {
    mockList.mockReturnValue([]);
    const tools = setup();
    const result = (await tools
      .get("queue_schedule_list")
      ?.handler(rawMetadataArg)) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("No scheduled tasks");
  });

  test("queue_schedule_update forwards optional fields", async () => {
    mockUpdate.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_update")?.handler({
      ...rawMetadataArg,
      id: "task-1",
      description: "new",
      prompt: "new-p",
      cron: "@daily",
      timezone: "UTC",
      overlap: "queue",
      notifyOnFailure: false,
      maxRuntimeMs: 60000,
    });
    expect(mockUpdate).toHaveBeenCalledWith("task-1", {
      description: "new",
      prompt: "new-p",
      cron: "@daily",
      timezone: "UTC",
      overlap: "queue",
      notifyOnFailure: false,
      maxRuntimeMs: 60000,
    });
  });

  test("queue_schedule_update with minimal input", async () => {
    mockUpdate.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_update")?.handler({
      ...rawMetadataArg,
      id: "task-1",
    });
    expect(mockUpdate).toHaveBeenCalledWith("task-1", {});
  });

  test("queue_schedule_delete forwards id", async () => {
    mockDelete.mockResolvedValue(undefined);
    const tools = setup();
    await tools.get("queue_schedule_delete")?.handler({
      ...rawMetadataArg,
      id: "task-1",
    });
    expect(mockDelete).toHaveBeenCalledWith("task-1");
  });

  test("queue_schedule_enable calls scheduler.enable", async () => {
    mockEnable.mockResolvedValue(makeTask());
    const tools = setup();
    await tools.get("queue_schedule_enable")?.handler({
      ...rawMetadataArg,
      id: "task-1",
    });
    expect(mockEnable).toHaveBeenCalledWith("task-1");
  });

  test("queue_schedule_disable calls scheduler.disable", async () => {
    mockDisable.mockResolvedValue(makeTask({ enabled: false }));
    const tools = setup();
    await tools.get("queue_schedule_disable")?.handler({
      ...rawMetadataArg,
      id: "task-1",
    });
    expect(mockDisable).toHaveBeenCalledWith("task-1");
  });

  test("queue_schedule_trigger returns scheduleId, runId, queueJobId, enqueuedAt", async () => {
    mockTrigger.mockResolvedValue({
      scheduleId: "task-1",
      runId: "run-1",
      queueJobId: "j-1",
      enqueuedAt: 123,
    });
    const tools = setup();
    const result = (await tools.get("queue_schedule_trigger")?.handler({
      ...rawMetadataArg,
      id: "task-1",
    })) as {
      structuredContent: Scheduler.TriggerResult;
      content: { text: string }[];
    };
    expect(result.structuredContent).toEqual({
      scheduleId: "task-1",
      runId: "run-1",
      queueJobId: "j-1",
      enqueuedAt: 123,
    });
    expect(result.content[0]?.text).toContain("run run-1");
  });

  test("queue_runs forwards all filters to scheduler.listRuns", async () => {
    mockListRuns.mockReturnValue([makeRun()]);
    const tools = setup();
    await tools.get("queue_runs")?.handler({
      ...rawMetadataArg,
      scheduleId: "task-1",
      runSessionId: "opencode-sess-7",
      status: "reported",
      trigger: "cron",
      since: 1000,
      until: 2000,
      limit: 10,
      offset: 0,
    });
    expect(mockListRuns).toHaveBeenCalledWith({
      scheduleId: "task-1",
      runSessionId: "opencode-sess-7",
      status: "reported",
      trigger: "cron",
      since: 1000,
      until: 2000,
      limit: 10,
      offset: 0,
    });
  });

  test("queue_runs with no filters passes empty object", async () => {
    mockListRuns.mockReturnValue([]);
    const tools = setup();
    const result = (await tools.get("queue_runs")?.handler(rawMetadataArg)) as {
      content: { text: string }[];
    };
    expect(mockListRuns).toHaveBeenCalledWith({});
    expect(result.content[0]?.text).toContain("No matching runs");
  });

  test("queue_runs formats output with timing", async () => {
    mockListRuns.mockReturnValue([
      makeRun({
        status: "silent",
        startedAt: 1000,
        finishedAt: 1500,
        output: null,
      }),
      makeRun({
        id: "run-2",
        status: "failed",
        error: "boom",
        finishedAt: null,
      }),
    ]);
    const tools = setup();
    const result = (await tools.get("queue_runs")?.handler(rawMetadataArg)) as {
      content: { text: string }[];
    };
    expect(result.content[0]?.text).toContain("silent");
    expect(result.content[0]?.text).toContain("failed");
    expect(result.content[0]?.text).toContain("boom");
  });

  test("queue_run_get returns full structured content", async () => {
    mockGetRun.mockReturnValue(makeRun());
    const tools = setup();
    const result = (await tools.get("queue_run_get")?.handler({
      ...rawMetadataArg,
      id: "run-1",
    })) as { structuredContent: Scheduler.Run };
    expect(result.structuredContent.id).toBe("run-1");
    expect(mockGetRun).toHaveBeenCalledWith("run-1");
  });

  test("queue_run_get formats text with output or error", async () => {
    mockGetRun.mockReturnValueOnce(
      makeRun({ status: "failed", error: "fail-msg", output: null }),
    );
    const tools = setup();
    const result = (await tools.get("queue_run_get")?.handler({
      ...rawMetadataArg,
      id: "run-1",
    })) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("fail-msg");
  });

  test("queue_run_get surfaces runSessionId so the agent can export the run's session", async () => {
    mockGetRun.mockReturnValueOnce(
      makeRun({ runSessionId: "opencode-run-abc" }),
    );
    const tools = setup();
    const result = (await tools.get("queue_run_get")?.handler({
      ...rawMetadataArg,
      id: "run-1",
    })) as {
      content: { text: string }[];
      structuredContent: Scheduler.Run;
    };
    expect(result.structuredContent.runSessionId).toBe("opencode-run-abc");
    expect(result.content[0]?.text).toContain("opencode-run-abc");
  });

  test("queue_run_get omits runSessionId line when the run never acquired a session", async () => {
    mockGetRun.mockReturnValueOnce(
      makeRun({ runSessionId: null, status: "cancelled", output: null }),
    );
    const tools = setup();
    const result = (await tools.get("queue_run_get")?.handler({
      ...rawMetadataArg,
      id: "run-1",
    })) as { content: { text: string }[] };
    expect(result.content[0]?.text).not.toContain("Ran in session");
  });

  test("queue_runs shows runSessionId inline for each run that acquired one", async () => {
    mockListRuns.mockReturnValue([
      makeRun({ runSessionId: "opencode-run-A", finishedAt: 1500 }),
      makeRun({
        id: "run-2",
        runSessionId: null,
        output: null,
        finishedAt: 1500,
      }),
    ]);
    const tools = setup();
    const result = (await tools.get("queue_runs")?.handler(rawMetadataArg)) as {
      content: { text: string }[];
    };
    expect(result.content[0]?.text).toContain("runSession=opencode-run-A");
    const lines = result.content[0]?.text.split("\n") ?? [];
    expect(lines.find((line) => line.includes("run-2"))).not.toContain(
      "runSession=",
    );
  });

  test("queue_run_cancel calls scheduler.cancelRun", async () => {
    mockCancelRun.mockResolvedValue(makeRun({ status: "cancelled" }));
    const tools = setup();
    await tools.get("queue_run_cancel")?.handler({
      ...rawMetadataArg,
      id: "run-1",
    });
    expect(mockCancelRun).toHaveBeenCalledWith("run-1");
  });

  test("queue_status returns paused state and counts", async () => {
    const tools = setup();
    const result = (await tools
      .get("queue_status")
      ?.handler(rawMetadataArg)) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("paused");
    expect(result.content[0]?.text).toContain("waiting");
  });

  test("queue_list_jobs forwards state/start/end/asc filters", async () => {
    const tools = setup();
    await tools.get("queue_list_jobs")?.handler({
      ...rawMetadataArg,
      state: "waiting",
      start: 0,
      end: 10,
      asc: true,
    });
    expect(mockBunqueue.queue.getJobsAsync).toHaveBeenCalledWith({
      state: "waiting",
      start: 0,
      end: 10,
      asc: true,
    });
  });

  test("queue_list_jobs with no filters", async () => {
    const tools = setup();
    await tools.get("queue_list_jobs")?.handler(rawMetadataArg);
    expect(mockBunqueue.queue.getJobsAsync).toHaveBeenCalledWith({});
  });

  test("queue_list_crons returns bunqueue crons", async () => {
    mockBunqueue.listCrons.mockResolvedValueOnce([
      { id: "c-1", name: "c-1", next: 123 },
    ]);
    const tools = setup();
    const result = (await tools
      .get("queue_list_crons")
      ?.handler(rawMetadataArg)) as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("c-1");
  });
});
