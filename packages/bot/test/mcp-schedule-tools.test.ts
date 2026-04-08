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
    nextRun: "2026-04-07T01:00:00.000Z",
    ...overrides,
  };
}

describe("registerScheduleTools", () => {
  const mockSchedulerCreate = vi.fn<() => Promise<Scheduler.Task>>();
  const mockSchedulerList = vi.fn<() => Scheduler.Task[]>();
  const mockSchedulerDelete = vi.fn<() => Promise<void>>();
  const mockSchedulerTrigger = vi.fn<() => Promise<void>>();
  const mockSchedulerUpdate = vi.fn<() => Promise<Scheduler.Task>>();

  const mockScheduler = {
    create: mockSchedulerCreate,
    list: mockSchedulerList,
    delete: mockSchedulerDelete,
    trigger: mockSchedulerTrigger,
    update: mockSchedulerUpdate,
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

  test("registers exactly 6 tools", () => {
    const tools = setup();
    expect(tools.size).toBe(6);
    expect([...tools.keys()]).toEqual([
      "schedule_create",
      "schedule_list",
      "schedule_delete",
      "schedule_trigger",
      "schedule_update",
      "get_server_time",
    ]);
  });

  describe("schedule_create", () => {
    test("creates a recurring session task", async () => {
      const task = makeTask();
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const task = makeTask({ nextRun: null });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

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

  describe("schedule_list", () => {
    test("lists tasks and returns them", async () => {
      const tasks = [
        makeTask(),
        makeTask({ id: "task-2", description: "Second" }),
      ];
      mockSchedulerList.mockReturnValue(tasks);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

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
      mockSchedulerList.mockReturnValue([makeTask({ nextRun: null })]);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

      const result = (await tool.handler({ ...metadataArgs })) as {
        content: { text: string }[];
      };

      expect(result.content[0]?.text).toContain("N/A");
    });

    test("returns empty list when no tasks", async () => {
      mockSchedulerList.mockReturnValue([]);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

      const result = await tool.handler({ ...metadataArgs });

      expect(result).toEqual({
        content: [{ type: "text", text: "No scheduled tasks." }],
        structuredContent: { tasks: [] },
      });
    });
  });

  describe("schedule_delete", () => {
    test("deletes a task and returns deleted: true", async () => {
      mockSchedulerDelete.mockResolvedValue(undefined);

      const tools = setup();
      const tool = tools.get("schedule_delete");
      if (!tool) throw new Error("schedule_delete not registered");

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
      const tool = tools.get("schedule_delete");
      if (!tool) throw new Error("schedule_delete not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing" }),
      ).rejects.toBe(error);
    });
  });

  describe("schedule_trigger", () => {
    test("triggers a task and returns triggered: true", async () => {
      mockSchedulerTrigger.mockResolvedValue(undefined);

      const tools = setup();
      const tool = tools.get("schedule_trigger");
      if (!tool) throw new Error("schedule_trigger not registered");

      const args = { ...metadataArgs, id: "task-1" };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerTrigger).toHaveBeenCalledWith("task-1");
      expect(result).toEqual({
        content: [{ type: "text", text: "Triggered schedule task-1." }],
        structuredContent: { triggered: true },
      });
    });

    test("propagates scheduler.trigger errors", async () => {
      const error = new Error("not found");
      mockSchedulerTrigger.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("schedule_trigger");
      if (!tool) throw new Error("schedule_trigger not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing" }),
      ).rejects.toBe(error);
    });
  });

  describe("schedule_update", () => {
    test("updates task and returns updated result", async () => {
      const updated = makeTask({ description: "Updated" });
      mockSchedulerUpdate.mockResolvedValue(updated);

      const tools = setup();
      const tool = tools.get("schedule_update");
      if (!tool) throw new Error("schedule_update not registered");

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
      const updated = makeTask({ nextRun: null });
      mockSchedulerUpdate.mockResolvedValue(updated);

      const tools = setup();
      const tool = tools.get("schedule_update");
      if (!tool) throw new Error("schedule_update not registered");

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
      const tool = tools.get("schedule_update");
      if (!tool) throw new Error("schedule_update not registered");

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
      const tool = tools.get("schedule_update");
      if (!tool) throw new Error("schedule_update not registered");

      await expect(
        tool.handler({ ...metadataArgs, id: "missing", prompt: "x" }),
      ).rejects.toBe(error);
    });
  });

  describe("get_server_time", () => {
    test("returns current server time with all fields", async () => {
      const tools = setup();
      const tool = tools.get("get_server_time");
      if (!tool) throw new Error("get_server_time not registered");

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
      "schedule_create",
      "schedule_list",
      "schedule_delete",
      "schedule_trigger",
      "schedule_update",
    ] as const)("%s calls getMetadata with the full args object", async (toolName) => {
      mockSchedulerCreate.mockResolvedValue(makeTask());
      mockSchedulerList.mockReturnValue([]);
      mockSchedulerDelete.mockResolvedValue(undefined);
      mockSchedulerTrigger.mockResolvedValue(undefined);
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
});
