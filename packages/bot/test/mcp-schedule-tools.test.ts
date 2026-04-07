import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { registerScheduleTools } from "~/lib/mcp-schedule-tools";
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
    type: "message",
    cron: "0 * * * *",
    description: "Hourly task",
    prompt: "Do something",
    paused: false,
    once: false,
    nextRun: "2026-04-07T01:00:00.000Z",
    ...overrides,
  };
}

describe("registerScheduleTools", () => {
  const mockSchedulerCreate = vi.fn<() => Promise<Scheduler.Task>>();
  const mockSchedulerList = vi.fn<() => Promise<Scheduler.Task[]>>();
  const mockSchedulerDelete = vi.fn<() => Promise<void>>();
  const mockSchedulerTrigger = vi.fn<() => Promise<void>>();

  const mockScheduler = {
    create: mockSchedulerCreate,
    list: mockSchedulerList,
    delete: mockSchedulerDelete,
    trigger: mockSchedulerTrigger,
  } as never as Scheduler;

  const mockExistingSessionsGet =
    vi.fn<(sessionId: string) => ExistingSessions.Location | undefined>();
  const mockExistingSessions = {
    get: mockExistingSessionsGet,
  } as never as ExistingSessions;

  const mockGetMetadata = vi.fn<(args: unknown) => { sessionID: string }>();

  const defaultLocation: ExistingSessions.Location = {
    chatId: 42,
    threadId: 7,
  };

  const metadataArgs = { __OPENKITTEN__: { sessionID: "sess-1" } };

  beforeEach(() => {
    mockSchedulerCreate.mockClear();
    mockSchedulerList.mockClear();
    mockSchedulerDelete.mockClear();
    mockSchedulerTrigger.mockClear();
    mockExistingSessionsGet.mockClear();
    mockGetMetadata.mockClear();

    mockGetMetadata.mockReturnValue({ sessionID: "sess-1" });
    mockExistingSessionsGet.mockReturnValue(defaultLocation);
  });

  function setup() {
    const { registeredTools, mockServer } = makeRegisteredTools();
    registerScheduleTools(mockServer as never, {
      scheduler: mockScheduler,
      existingSessions: mockExistingSessions,
      getMetadata: mockGetMetadata,
    });
    return registeredTools;
  }

  test("registers exactly 5 tools", () => {
    const tools = setup();
    expect(tools.size).toBe(5);
    expect([...tools.keys()]).toEqual([
      "schedule_create",
      "schedule_list",
      "schedule_delete",
      "schedule_trigger",
      "get_server_time",
    ]);
  });

  describe("schedule_create", () => {
    test("creates a recurring task and returns task result", async () => {
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
      expect(mockExistingSessionsGet).toHaveBeenCalledWith("sess-1");
      expect(mockSchedulerCreate).toHaveBeenCalledWith({
        type: "message",
        chatId: 42,
        threadId: 7,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
        once: false,
      });
      expect(result).toEqual({
        content: [{ type: "text", text: "Created schedule: Hourly task" }],
        structuredContent: { ...task },
      });
    });

    test("creates a once task when once=true", async () => {
      const task = makeTask({ once: true });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

      const args = {
        ...metadataArgs,
        cron: "0 * * * *",
        description: "Hourly task",
        prompt: "Do something",
        once: true,
      };
      await tool.handler(args);

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ once: true }),
      );
    });

    test("defaults once to false when omitted", async () => {
      const task = makeTask();
      mockSchedulerCreate.mockResolvedValue(task);

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

    test('passes type "prompt" through to scheduler.create', async () => {
      const task = makeTask({ type: "prompt" });
      mockSchedulerCreate.mockResolvedValue(task);

      const tools = setup();
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

      await tool.handler({
        ...metadataArgs,
        type: "prompt",
        cron: "0 * * * *",
        description: "Prompt task",
        prompt: "Summarise daily activity",
      });

      expect(mockSchedulerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "prompt" }),
      );
    });

    test('defaults type to "message" when omitted', async () => {
      const task = makeTask();
      mockSchedulerCreate.mockResolvedValue(task);

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
        expect.objectContaining({ type: "message" }),
      );
    });

    test("throws when session is not found", async () => {
      mockExistingSessionsGet.mockReturnValue(undefined);

      const tools = setup();
      const tool = tools.get("schedule_create");
      if (!tool) throw new Error("schedule_create not registered");

      await expect(
        tool.handler({
          ...metadataArgs,
          cron: "0 * * * *",
          description: "Hourly task",
          prompt: "Do something",
        }),
      ).rejects.toThrow("Session not found: sess-1");
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
      mockSchedulerList.mockResolvedValue(tasks);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

      const args = { ...metadataArgs };
      const result = await tool.handler(args);

      expect(mockGetMetadata).toHaveBeenCalledWith(args);
      expect(mockSchedulerList).toHaveBeenCalledWith();
      expect(result).toEqual({
        content: [{ type: "text", text: "Found 2 scheduled task(s)." }],
        structuredContent: { tasks: tasks.map((t) => ({ ...t })) },
      });
    });

    test("returns empty list when no tasks", async () => {
      mockSchedulerList.mockResolvedValue([]);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

      const result = await tool.handler({ ...metadataArgs });

      expect(result).toEqual({
        content: [{ type: "text", text: "Found 0 scheduled task(s)." }],
        structuredContent: { tasks: [] },
      });
    });

    test("propagates scheduler.list errors", async () => {
      const error = new Error("list failed");
      mockSchedulerList.mockRejectedValue(error);

      const tools = setup();
      const tool = tools.get("schedule_list");
      if (!tool) throw new Error("schedule_list not registered");

      await expect(tool.handler({ ...metadataArgs })).rejects.toBe(error);
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
        tool.handler({
          ...metadataArgs,
          id: "missing",
        }),
      ).rejects.toBe(error);
    });
  });

  describe("schedule_trigger", () => {
    test("triggers a task immediately and returns triggered: true", async () => {
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
        tool.handler({
          ...metadataArgs,
          id: "missing",
        }),
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
        {
          type: "text",
          text: expect.stringContaining("Server time:"),
        },
      ]);
    });
  });

  describe("getMetadata verification", () => {
    test.each([
      "schedule_create",
      "schedule_list",
      "schedule_delete",
      "schedule_trigger",
    ] as const)("%s calls getMetadata with the full args object", async (toolName) => {
      mockSchedulerCreate.mockResolvedValue(makeTask());
      mockSchedulerList.mockResolvedValue([]);
      mockSchedulerDelete.mockResolvedValue(undefined);
      mockSchedulerTrigger.mockResolvedValue(undefined);

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
