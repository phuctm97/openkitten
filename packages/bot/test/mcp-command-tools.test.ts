import { beforeEach, describe, expect, test, vi } from "vitest";
import { CommandRegistry } from "~/lib/command-registry";
import { registerCommandTools } from "~/lib/mcp-command-tools";

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

const metadata = { __OPENKITTEN__: { sessionID: "s1", callID: "c1" } };

const { mockSetMyCommands } = vi.hoisted(() => ({
  mockSetMyCommands: vi.fn(async () => true),
}));

vi.mock("grammy", () => ({
  Api: class MockApi {
    setMyCommands = mockSetMyCommands;
  },
}));

describe("registerCommandTools", () => {
  const mockCreate =
    vi.fn<(input: CommandRegistry.CreateInput) => CommandRegistry.Command>();
  const mockUpdate =
    vi.fn<(input: CommandRegistry.UpdateInput) => CommandRegistry.Command>();
  const mockDelete = vi.fn<(name: string) => void>();
  const mockList = vi.fn<() => readonly CommandRegistry.Command[]>();
  const mockGet =
    vi.fn<(name: string) => CommandRegistry.Command | undefined>();
  const mockToTelegramCommands =
    vi.fn<() => readonly CommandRegistry.TelegramCommand[]>();

  const mockRegistry = {
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    list: mockList,
    get: mockGet,
    toTelegramCommands: mockToTelegramCommands,
  } as never as CommandRegistry;

  const mockGetMetadata = vi.fn(() => ({ sessionID: "s1", callID: "c1" }));

  beforeEach(() => {
    vi.resetAllMocks();
    mockToTelegramCommands.mockReturnValue(CommandRegistry.builtins);
    mockSetMyCommands.mockResolvedValue(true);
  });

  function registerAndGet() {
    const { registeredTools, mockServer } = makeRegisteredTools();
    registerCommandTools(mockServer as never, {
      commandRegistry: mockRegistry,
      botToken: "test-token",
      getMetadata: mockGetMetadata,
    });
    return registeredTools;
  }

  function getTool(
    tools: Map<string, RegisteredTool>,
    name: string,
  ): RegisteredTool {
    const tool = tools.get(name);
    if (!tool) throw new Error(`Expected tool ${name} to be registered`);
    return tool;
  }

  test("registers four tools", () => {
    const tools = registerAndGet();
    expect(tools.has("command_create")).toBe(true);
    expect(tools.has("command_update")).toBe(true);
    expect(tools.has("command_delete")).toBe(true);
    expect(tools.has("command_list")).toBe(true);
  });

  test("command_create creates command and refreshes Telegram", async () => {
    const cmd = { name: "hello", description: "Say hi", prompt: "Hi!" };
    mockCreate.mockReturnValue(cmd);
    const tools = registerAndGet();
    const result = await getTool(tools, "command_create").handler({
      ...metadata,
      name: "hello",
      description: "Say hi",
      prompt: "Hi!",
    });
    expect(mockCreate).toHaveBeenCalledWith({
      name: "hello",
      description: "Say hi",
      prompt: "Hi!",
    });
    expect(mockSetMyCommands).toHaveBeenCalledOnce();
    expect(result).toEqual(
      expect.objectContaining({
        structuredContent: { ...cmd },
      }),
    );
  });

  test("command_create validates metadata", async () => {
    const tools = registerAndGet();
    mockGetMetadata.mockImplementationOnce(() => {
      throw new Error("No metadata");
    });
    await expect(
      getTool(tools, "command_create").handler({
        name: "hello",
        description: "Say hi",
        prompt: "Hi!",
      }),
    ).rejects.toThrow("No metadata");
  });

  test("command_create propagates DuplicateError", async () => {
    mockCreate.mockImplementation(() => {
      throw new CommandRegistry.DuplicateError("dup");
    });
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_create").handler({
        ...metadata,
        name: "dup",
        description: "D",
        prompt: "P",
      }),
    ).rejects.toThrow(CommandRegistry.DuplicateError);
  });

  test("command_create propagates ReservedError", async () => {
    mockCreate.mockImplementation(() => {
      throw new CommandRegistry.ReservedError("start");
    });
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_create").handler({
        ...metadata,
        name: "start",
        description: "D",
        prompt: "P",
      }),
    ).rejects.toThrow(CommandRegistry.ReservedError);
  });

  test("command_update updates command and refreshes Telegram", async () => {
    const cmd = { name: "hello", description: "New", prompt: "Hi!" };
    mockUpdate.mockReturnValue(cmd);
    const tools = registerAndGet();
    const result = await getTool(tools, "command_update").handler({
      ...metadata,
      name: "hello",
      description: "New",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      name: "hello",
      description: "New",
      prompt: undefined,
    });
    expect(mockSetMyCommands).toHaveBeenCalledOnce();
    expect(result).toEqual(
      expect.objectContaining({
        structuredContent: { ...cmd },
      }),
    );
  });

  test("command_update propagates NotFoundError", async () => {
    mockUpdate.mockImplementation(() => {
      throw new CommandRegistry.NotFoundError("nope");
    });
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_update").handler({
        ...metadata,
        name: "nope",
        description: "X",
      }),
    ).rejects.toThrow(CommandRegistry.NotFoundError);
  });

  test("command_delete deletes command and refreshes Telegram", async () => {
    const tools = registerAndGet();
    const result = await getTool(tools, "command_delete").handler({
      ...metadata,
      name: "hello",
    });
    expect(mockDelete).toHaveBeenCalledWith("hello");
    expect(mockSetMyCommands).toHaveBeenCalledOnce();
    expect(result).toEqual(
      expect.objectContaining({
        structuredContent: { deleted: true },
      }),
    );
  });

  test("command_delete propagates NotFoundError", async () => {
    mockDelete.mockImplementation(() => {
      throw new CommandRegistry.NotFoundError("nope");
    });
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_delete").handler({ ...metadata, name: "nope" }),
    ).rejects.toThrow(CommandRegistry.NotFoundError);
  });

  test("command_list returns all commands", async () => {
    const commands = [{ name: "hello", description: "Say hi", prompt: "Hi!" }];
    mockList.mockReturnValue(commands);
    const tools = registerAndGet();
    const result = await getTool(tools, "command_list").handler({
      ...metadata,
    });
    expect(result).toEqual(
      expect.objectContaining({
        structuredContent: { commands },
      }),
    );
  });

  test("command_list returns empty message when no commands", async () => {
    mockList.mockReturnValue([]);
    const tools = registerAndGet();
    const result = (await getTool(tools, "command_list").handler({
      ...metadata,
    })) as { content: readonly { text: string }[] };
    expect(result.content).toEqual([
      { type: "text", text: "No custom commands." },
    ]);
  });

  test("command_list includes command details in text", async () => {
    mockList.mockReturnValue([
      { name: "hello", description: "Say hi", prompt: "Hi!" },
    ]);
    const tools = registerAndGet();
    const result = (await getTool(tools, "command_list").handler({
      ...metadata,
    })) as { content: readonly { text: string }[] };
    expect(result.content).toEqual([
      {
        type: "text",
        text: "1 custom command(s):\n/hello — Say hi (prompt: Hi!)",
      },
    ]);
  });

  test("command_list validates metadata", async () => {
    const tools = registerAndGet();
    mockGetMetadata.mockImplementationOnce(() => {
      throw new Error("No metadata");
    });
    await expect(getTool(tools, "command_list").handler({})).rejects.toThrow(
      "No metadata",
    );
  });

  test("command_create rolls back on Telegram refresh failure", async () => {
    const cmd = { name: "hello", description: "Say hi", prompt: "Hi!" };
    mockCreate.mockReturnValue(cmd);
    mockSetMyCommands.mockRejectedValueOnce(new Error("Telegram error"));
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_create").handler({
        ...metadata,
        name: "hello",
        description: "Say hi",
        prompt: "Hi!",
      }),
    ).rejects.toThrow("Telegram error");
    expect(mockDelete).toHaveBeenCalledWith("hello");
  });

  test("command_update rolls back on Telegram refresh failure", async () => {
    const before = { name: "hello", description: "Old", prompt: "Old P" };
    const updated = { name: "hello", description: "New", prompt: "Old P" };
    mockGet.mockReturnValueOnce(before);
    mockUpdate.mockReturnValueOnce(updated);
    mockSetMyCommands.mockRejectedValueOnce(new Error("Telegram error"));
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_update").handler({
        ...metadata,
        name: "hello",
        description: "New",
      }),
    ).rejects.toThrow("Telegram error");
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith({
      name: "hello",
      description: "Old",
      prompt: "Old P",
    });
  });

  test("command_delete rolls back on Telegram refresh failure", async () => {
    const before = { name: "hello", description: "Say hi", prompt: "Hi!" };
    mockGet.mockReturnValueOnce(before);
    mockSetMyCommands.mockRejectedValueOnce(new Error("Telegram error"));
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_delete").handler({ ...metadata, name: "hello" }),
    ).rejects.toThrow("Telegram error");
    expect(mockCreate).toHaveBeenCalledWith(before);
  });
});
