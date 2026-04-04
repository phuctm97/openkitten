import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InputFile } from "grammy";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import zod from "zod";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";

vi.mock("node:crypto", () => ({
  randomBytes: vi.fn(() => ({
    toString: () => "test-token-abc123",
  })),
}));

const {
  mockStop,
  mockConnect,
  mockHandleRequest,
  registeredTools,
  sdkConstructorArgs,
} = vi.hoisted(() => ({
  mockStop: vi.fn(),
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
    (_sessionId: string): { chatId: number; threadId: number | undefined } => ({
      chatId: 123,
      threadId: 456,
    }),
  );
  const existingSessions = { get: existingSessionsGet } as never;
  const tempDirs: string[] = [];

  beforeEach(() => {
    mockStop.mockClear();
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

  test("logs connecting and connected", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    expect(logger.debug).toHaveBeenCalledWith("MCP server is connecting…");
    expect(logger.info).toHaveBeenCalledWith("MCP server is connected", {
      url: "http://127.0.0.1:12345/mcp",
    });
  });

  test("starts Bun.serve on localhost with random port", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    expect(Bun.serve).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "127.0.0.1", port: 0 }),
    );
  });

  test("registers with OpenCode server", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
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
      McpServer.create(failingClient, bot, existingSessions),
    ).rejects.toThrow(error);
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("disconnected resolves on disposal", async () => {
    const server = await McpServer.create(mockClient, bot, existingSessions);
    server[Symbol.dispose]();
    await expect(server.disconnected).resolves.toBeUndefined();
  });

  test("stops HTTP server on disposal", async () => {
    {
      using _server = await McpServer.create(mockClient, bot, existingSessions);
    }
    expect(mockStop).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith("MCP server is disconnected");
  });

  test("returns 404 for non-MCP paths", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    const response = await capturedFetch(new Request("http://localhost/other"));
    expect(response.status).toBe(404);
  });

  test("returns 401 for missing auth", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    const response = await capturedFetch(
      new Request("http://localhost/mcp", { method: "POST" }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 401 for wrong auth", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    const response = await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" },
      }),
    );
    expect(response.status).toBe(401);
  });

  test("creates SDK server and transport for MCP requests", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
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
        websiteUrl: "https://openkitten.com",
      },
    ]);
    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockHandleRequest).toHaveBeenCalledWith(req);
    expect(await response.text()).toBe("mcp-ok");
  });

  test("registers the send_file tool for MCP requests", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);

    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    expect(registeredTools).toEqual([
      expect.objectContaining({ name: "send_file" }),
    ]);
  });

  test("send_file sends a local png as a Telegram photo with caption", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, "photo.png");
    await Bun.write(path, "png-bytes");

    using _server = await McpServer.create(mockClient, bot, existingSessions);
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
      caption: "Look at this cat",
      __OPENKITTEN__: { sessionID: "sess-1", callID: "call-1" },
    });

    expect(existingSessionsGet).toHaveBeenCalledWith("sess-1");
    expect(botApi.sendPhoto).toHaveBeenCalledWith(123, expect.any(InputFile), {
      caption: "Look at this cat",
      message_thread_id: 456,
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "Sent photo.png as photo." }],
      structuredContent: {
        filename: "photo.png",
        kind: "photo",
      },
    });
  });

  test("send_file sends sticker captions as a follow-up text message", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-server-"));
    tempDirs.push(dir);
    const path = join(dir, "party.tgs");
    await Bun.write(path, "sticker-bytes");

    existingSessionsGet.mockReturnValueOnce({
      chatId: 777,
      threadId: undefined,
    });

    using _server = await McpServer.create(mockClient, bot, existingSessions);
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
      caption: "Party time",
      __OPENKITTEN__: { sessionID: "sess-2", callID: "call-2" },
    });

    expect(botApi.sendSticker).toHaveBeenCalledWith(
      777,
      expect.any(InputFile),
      {},
    );
    expect(botApi.sendMessage).toHaveBeenCalledWith(777, "Party time", {});
    expect(result).toEqual({
      content: [{ type: "text", text: "Sent party.tgs as sticker." }],
      structuredContent: {
        filename: "party.tgs",
        kind: "sticker",
      },
    });
  });

  test("send_file rejects calls without OpenKitten metadata", async () => {
    using _server = await McpServer.create(mockClient, bot, existingSessions);
    await capturedFetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc123" },
      }),
    );

    const tool = registeredTools.find((entry) => entry.name === "send_file");
    if (!tool) throw new Error("send_file tool was not registered");

    await expect(tool.handler({ path: "/tmp/file.txt" })).rejects.toThrow(
      zod.ZodError,
    );
  });
});
