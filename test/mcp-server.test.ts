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

  beforeEach(() => {
    mockStop.mockClear();
    mockConnect.mockClear();
    mockHandleRequest.mockClear();
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

  test("logs start and ready", async () => {
    await using _server = McpServer.create();
    expect(logger.debug).toHaveBeenCalledWith("MCP server is starting…");
    expect(logger.info).toHaveBeenCalledWith("MCP server is ready", {
      url: "http://127.0.0.1:12345/",
    });
  });

  test("starts Bun.serve on localhost with random port", async () => {
    await using _server = McpServer.create();
    expect(Bun.serve).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "127.0.0.1", port: 0 }),
    );
  });

  test("stopped resolves on disposal", async () => {
    const server = McpServer.create();
    await server[Symbol.asyncDispose]();
    await expect(server.stopped).resolves.toBeUndefined();
  });

  test("stops HTTP server on disposal", async () => {
    {
      await using _server = McpServer.create();
    }
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("returns 404 for non-MCP paths", async () => {
    await using _server = McpServer.create();
    const response = await capturedFetch(new Request("http://localhost/other"));
    expect(response.status).toBe(404);
  });

  test("creates SDK server and transport for MCP requests", async () => {
    await using _server = McpServer.create();
    const req = new Request("http://localhost/mcp", { method: "POST" });
    const response = await capturedFetch(req);

    expect(sdkConstructorArgs).toEqual([
      { name: "openkitten", version: "0.0.0" },
    ]);
    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockHandleRequest).toHaveBeenCalledWith(req);
    expect(await response.text()).toBe("mcp-ok");
  });
});
