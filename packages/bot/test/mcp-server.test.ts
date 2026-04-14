import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InputFile } from "grammy";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
import { websiteURL } from "~/lib/website-url";

vi.mock("node:crypto", () => ({
  randomBytes: vi.fn(() => ({
    toString: () => "test-token-abc123",
  })),
}));

const {
  mockStop,
  mockTimeout,
  mockConnect,
  mockHandleRequest,
  registeredTools,
  sdkConstructorArgs,
} = vi.hoisted(() => ({
  mockStop: vi.fn(),
  mockTimeout: vi.fn(),
  mockConnect: vi.fn(async () => {}),
  mockHandleRequest: vi.fn(async () => new Response("mcp-ok")),
  registeredTools: [] as {
    config: unknown;
    handler: (...args: readonly unknown[]) => Promise<unknown> | unknown;
    name: string;
  }[],
  sdkConstructorArgs: [] as unknown[],
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    connect = mockConnect;
    registerTool(
      name: string,
      config: unknown,
      handler: (...args: readonly unknown[]) => Promise<unknown> | unknown,
    ) {
      registeredTools.push({ config, handler, name });
    }
    constructor(info: unknown) {
      sdkConstructorArgs.push(info);
    }
  },
}));

vi.mock(
  "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js",
  () => ({
    WebStandardStreamableHTTPServerTransport: class {
      handleRequest = mockHandleRequest;
    },
  }),
);

describe("McpServer", () => {
  let capturedFetch: (req: Request) => Response | Promise<Response>;
  const mockMcpAdd = vi.fn(async () => ({ data: {} }));
  const mockClient = { mcp: { add: mockMcpAdd } } as never;
  const botApi = {
    sendAnimation: vi.fn(async () => ({})),
    sendAudio: vi.fn(async () => ({})),
    sendDocument: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
    sendPhoto: vi.fn(async () => ({})),
    sendSticker: vi.fn(async () => ({})),
    sendVideo: vi.fn(async () => ({})),
  };
  const bot = { api: botApi } as never;
  const existingSessionsGet = vi.fn(
    (
      _sessionId: string,
    ): { chatId: number; threadId: number | undefined } | undefined => ({
      chatId: 123,
      threadId: 456,
    }),
  );
  const existingSessions = { get: existingSessionsGet } as never;
  const mockScheduler = {} as never;
  const tempDirs: string[] = [];

  beforeEach(() => {
    mockStop.mockClear();
    mockTimeout.mockClear();
    mockConnect.mockClear();
    mockHandleRequest.mockClear();
    mockMcpAdd.mockClear();
    existingSessionsGet.mockClear();
    botApi.sendAnimation.mockClear();
    botApi.sendAudio.mockClear();
    botApi.sendDocument.mockClear();
    botApi.sendMessage.mockClear();
    botApi.sendPhoto.mockClear();
    botApi.sendSticker.mockClear();
    botApi.sendVideo.mockClear();
    registeredTools.length = 0;
    sdkConstructorArgs.length = 0;
    vi.spyOn(Bun, "serve").mockImplementation(((options: {
      fetch: (req: Request) => Response | Promise<Response>;
    }) => {
      capturedFetch = options.fetch;
      return {
        timeout: mockTimeout,
        url: new URL("http://127.0.0.1:12345"),
        [Symbol.dispose]: mockStop,
      };
    }) as never);
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { force: true, recursive: true })),
    );
  });

  test("logs starting and ready", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    expect(logger.debug).toHaveBeenCalledWith("MCP server is starting…");
    expect(logger.info).toHaveBeenCalledWith("MCP server is ready");
  });

  test("starts Bun.serve on localhost with random port", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    expect(Bun.serve).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "127.0.0.1", port: 0 }),
    );
  });

  test("registers with OpenCode server", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    expect(mockMcpAdd).toHaveBeenCalledWith(
      {
        name: "openkitten",
        config: {
          type: "remote",
          url: "http://127.0.0.1:12345/mcp",
          headers: { authorization: "Bearer test-token-abc123" },
        },
      },
      { throwOnError: true },
    );
  });

  test("disposes HTTP server if registration fails", async () => {
    const error = new Error("registration failed");
    const failingClient = {
      mcp: { add: vi.fn(async () => Promise.reject(error)) },
    } as never;
    await expect(
      McpServer.create(bot, failingClient, existingSessions, mockScheduler),
    ).rejects.toThrow(error);
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("exited resolves on disposal", async () => {
    const server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    server[Symbol.dispose]();
    await expect(server.exited).resolves.toBeUndefined();
  });

  test("stops HTTP server on disposal", async () => {
    {
      using _server = await McpServer.create(
        bot,
        mockClient,
        existingSessions,
        mockScheduler,
      );
    }
    expect(mockStop).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith("MCP server is terminated");
  });

  test("returns 404 for non-MCP paths", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    const response = await capturedFetch(new Request("http://localhost/other"));
    expect(response.status).toBe(404);
  });

  test("returns 401 for missing auth", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    const response = await capturedFetch(
      new Request("http://localhost/mcp", { method: "POST" }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 401 for wrong auth", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    const response = await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" },
      }),
    );
    expect(response.status).toBe(401);
  });

  test("creates SDK server and transport for MCP requests", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { authorization: "Bearer test-token-abc123" },
    });
    const response = await capturedFetch(req);

    expect(sdkConstructorArgs).toEqual([
      {
        name: "openkitten",
        title: "OpenKitten",
        version: "0.0.0",
        description:
          "Additional tools and resources for OpenKitten-powered agents",
        websiteUrl: websiteURL,
      },
    ]);
    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockTimeout).toHaveBeenCalledWith(req, 0);
    expect(mockHandleRequest).toHaveBeenCalledWith(req);
    expect(await response.text()).toBe("mcp-ok");
  });

  test("registers the send_file tool for MCP requests", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );

    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const toolNames = registeredTools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("send_file");
    expect(toolNames).toContain("queue_schedule_create");
    expect(toolNames).toContain("queue_schedule_list");
    expect(toolNames).toContain("queue_schedule_delete");
    expect(toolNames).toContain("queue_schedule_trigger");
    expect(toolNames).toContain("queue_schedule_update");
    expect(toolNames).toContain("queue_server_time");
  });

  test("schedule tools receive getMetadata from McpServer", async () => {
    const scheduler = {
      list: vi.fn(() => []),
    };
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      scheduler as never,
    );

    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find(
      (t: { name: string }) => t.name === "queue_schedule_list",
    );
    if (!tool) throw new Error("Expected queue_schedule_list tool");
    const result = (await tool.handler({
      __OPENKITTEN__: { sessionID: "sess-1", callID: "call-1" },
    })) as { structuredContent: { tasks: unknown[] } };
    expect(result.structuredContent.tasks).toEqual([]);
    expect(scheduler.list).toHaveBeenCalledOnce();
  });

  test("send_file sends a local png as a Telegram photo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, "photo.png");
    await Bun.write(path, "png-bytes");

    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    const result = await tool.handler({
      path,
      __OPENKITTEN__: { sessionID: "sess-1", callID: "call-1" },
    });

    expect(existingSessionsGet).toHaveBeenCalledWith("sess-1");
    expect(botApi.sendPhoto).toHaveBeenCalledWith(123, expect.any(InputFile), {
      message_thread_id: 456,
    });
    expect(botApi.sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: "text", text: "Sent photo.png as photo." }],
      structuredContent: {
        name: "photo.png",
        kind: "photo",
      },
    });
  });

  test.each([
    ["GIF animation", "anim.gif", "animation", "sendAnimation"],
    ["PDF document", "guide.pdf", "document", "sendDocument"],
    ["MP4 video", "clip.mp4", "video", "sendVideo"],
    ["MP3 audio", "song.mp3", "audio", "sendAudio"],
  ] as const)("send_file sends a local %s with the matching Telegram method", async (_label, filename, kind, apiMethod) => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, filename);
    await Bun.write(path, `${kind}-bytes`);

    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    const result = await tool.handler({
      path,
      __OPENKITTEN__: { sessionID: `sess-${kind}`, callID: `call-${kind}` },
    });

    expect(botApi[apiMethod]).toHaveBeenCalledWith(123, expect.any(InputFile), {
      message_thread_id: 456,
    });
    expect(botApi.sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: "text", text: `Sent ${filename} as ${kind}.` }],
      structuredContent: {
        name: filename,
        kind,
      },
    });
  });

  test("send_file sends local stickers without extra text messages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, "party.tgs");
    await Bun.write(path, "sticker-bytes");

    existingSessionsGet.mockReturnValueOnce({
      chatId: 777,
      threadId: undefined,
    });

    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    const result = await tool.handler({
      path,
      __OPENKITTEN__: { sessionID: "sess-2", callID: "call-2" },
    });

    expect(botApi.sendSticker).toHaveBeenCalledWith(
      777,
      expect.any(InputFile),
      {},
    );
    expect(botApi.sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: "text", text: "Sent party.tgs as sticker." }],
      structuredContent: {
        name: "party.tgs",
        kind: "sticker",
      },
    });
  });

  test("send_file rejects missing local files", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    await expect(
      tool.handler({
        path: "/tmp/does-not-exist.txt",
        __OPENKITTEN__: { sessionID: "sess-missing-file", callID: "call-1" },
      }),
    ).rejects.toThrow("File not found: /tmp/does-not-exist.txt");
  });

  test("send_file rejects unknown sessions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, "photo.png");
    await Bun.write(path, "png-bytes");

    existingSessionsGet.mockReturnValueOnce(undefined);

    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    await expect(
      tool.handler({
        path,
        __OPENKITTEN__: { sessionID: "sess-missing-session", callID: "call-1" },
      }),
    ).rejects.toThrow("Session not found: sess-missing-session");
  });

  test("send_file rejects calls without OpenKitten metadata", async () => {
    using _server = await McpServer.create(
      bot,
      mockClient,
      existingSessions,
      mockScheduler,
    );
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    await expect(tool.handler({ path: "/tmp/file.txt" })).rejects.toThrow(
      "No valid OpenKitten metadata found in MCP input",
    );
  });
});
