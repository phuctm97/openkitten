import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";

const { mockStop, mockConnect, mockHandleRequest, sdkConstructorArgs } =
  vi.hoisted(() => ({
    mockStop: vi.fn(),
    mockConnect: vi.fn(async () => {}),
    mockHandleRequest: vi.fn(async () => new Response("mcp-ok")),
    sdkConstructorArgs: [] as unknown[],
  }));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    connect = mockConnect;
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

  beforeEach(() => {
    mockStop.mockClear();
    mockConnect.mockClear();
    mockHandleRequest.mockClear();
    mockMcpAdd.mockClear();
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

  test("logs connecting and connected", async () => {
    using _server = await McpServer.create(mockClient);
    expect(logger.debug).toHaveBeenCalledWith("MCP server is connecting…");
    expect(logger.info).toHaveBeenCalledWith("MCP server is connected", {
      url: "http://127.0.0.1:12345/mcp",
    });
  });

  test("starts Bun.serve on localhost with random port", async () => {
    using _server = await McpServer.create(mockClient);
    expect(Bun.serve).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "127.0.0.1", port: 0 }),
    );
  });

  test("registers with OpenCode server", async () => {
    using _server = await McpServer.create(mockClient);
    expect(mockMcpAdd).toHaveBeenCalledWith(
      {
        name: "openkitten",
        config: { type: "remote", url: "http://127.0.0.1:12345/mcp" },
      },
      { throwOnError: true },
    );
  });

  test("disposes HTTP server if registration fails", async () => {
    const error = new Error("registration failed");
    const failingClient = {
      mcp: { add: vi.fn(async () => Promise.reject(error)) },
    } as never;
    await expect(McpServer.create(failingClient)).rejects.toThrow(error);
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("disconnected resolves on disposal", async () => {
    const server = await McpServer.create(mockClient);
    server[Symbol.dispose]();
    await expect(server.disconnected).resolves.toBeUndefined();
  });

  test("stops HTTP server on disposal", async () => {
    {
      using _server = await McpServer.create(mockClient);
    }
    expect(mockStop).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith("MCP server is disconnected");
  });

  test("returns 404 for non-MCP paths", async () => {
    using _server = await McpServer.create(mockClient);
    const response = await capturedFetch(new Request("http://localhost/other"));
    expect(response.status).toBe(404);
  });

  test("creates SDK server and transport for MCP requests", async () => {
    using _server = await McpServer.create(mockClient);
    const req = new Request("http://localhost/mcp", { method: "POST" });
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
});
