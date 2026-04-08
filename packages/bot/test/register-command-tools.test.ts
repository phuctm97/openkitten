import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CommandSkills } from "~/lib/command-skills";
import { registerCommandTools } from "~/lib/register-command-tools";

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

let skillsDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  mockSetMyCommands.mockResolvedValue(true);
  skillsDir = await mkdtemp(join(tmpdir(), "register-cmd-"));
});

afterEach(async () => {
  await rm(skillsDir, { recursive: true, force: true });
});

describe("registerCommandTools", () => {
  const mockGetMetadata = vi.fn(() => ({ sessionID: "s1", callID: "c1" }));

  function registerAndGet() {
    const { registeredTools, mockServer } = makeRegisteredTools();
    registerCommandTools(mockServer as never, {
      skillsDir,
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

  test("registers three tools", () => {
    const tools = registerAndGet();
    expect(tools.has("command_create")).toBe(true);
    expect(tools.has("command_delete")).toBe(true);
    expect(tools.has("command_list")).toBe(true);
  });

  test("command_create creates skill and updates Telegram", async () => {
    const tools = registerAndGet();
    const result = (await getTool(tools, "command_create").handler({
      ...metadata,
      name: "translate",
      description: "Translate text",
      prompt: "Translate to English.",
    })) as { structuredContent: CommandSkills.Command };

    expect(result.structuredContent).toEqual({
      name: "translate",
      description: "Translate text",
      prompt: "Translate to English.",
    });
    expect(mockSetMyCommands).toHaveBeenCalledOnce();
  });

  test("command_create validates metadata", async () => {
    const tools = registerAndGet();
    mockGetMetadata.mockImplementationOnce(() => {
      throw new Error("No metadata");
    });
    await expect(
      getTool(tools, "command_create").handler({
        name: "test",
        description: "D",
        prompt: "P",
      }),
    ).rejects.toThrow("No metadata");
  });

  test("command_create propagates ReservedError", async () => {
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_create").handler({
        ...metadata,
        name: "start",
        description: "D",
        prompt: "P",
      }),
    ).rejects.toThrow(CommandSkills.ReservedError);
  });

  test("command_create propagates DuplicateError", async () => {
    const tools = registerAndGet();
    await getTool(tools, "command_create").handler({
      ...metadata,
      name: "translate",
      description: "D",
      prompt: "P",
    });
    await expect(
      getTool(tools, "command_create").handler({
        ...metadata,
        name: "translate",
        description: "D2",
        prompt: "P2",
      }),
    ).rejects.toThrow(CommandSkills.DuplicateError);
  });

  test("command_delete deletes skill and updates Telegram", async () => {
    const tools = registerAndGet();
    await getTool(tools, "command_create").handler({
      ...metadata,
      name: "translate",
      description: "D",
      prompt: "P",
    });
    mockSetMyCommands.mockClear();

    const result = (await getTool(tools, "command_delete").handler({
      ...metadata,
      name: "translate",
    })) as { structuredContent: { deleted: boolean } };

    expect(result.structuredContent.deleted).toBe(true);
    expect(mockSetMyCommands).toHaveBeenCalledOnce();
  });

  test("command_delete propagates NotFoundError", async () => {
    const tools = registerAndGet();
    await expect(
      getTool(tools, "command_delete").handler({
        ...metadata,
        name: "nonexistent",
      }),
    ).rejects.toThrow(CommandSkills.NotFoundError);
  });

  test("command_list returns all commands", async () => {
    const tools = registerAndGet();
    await getTool(tools, "command_create").handler({
      ...metadata,
      name: "translate",
      description: "Translate",
      prompt: "P",
    });

    const result = (await getTool(tools, "command_list").handler({
      ...metadata,
    })) as { structuredContent: { commands: CommandSkills.Command[] } };

    expect(result.structuredContent.commands).toEqual([
      { name: "translate", description: "Translate", prompt: "P" },
    ]);
  });

  test("command_list returns empty when no commands", async () => {
    const tools = registerAndGet();
    const result = (await getTool(tools, "command_list").handler({
      ...metadata,
    })) as { content: readonly { text: string }[] };

    expect(result.content).toEqual([
      { type: "text", text: "No custom commands." },
    ]);
  });
});
