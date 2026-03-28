import { beforeEach, expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
import pkg from "~/package.json" with { type: "json" };

const mocks = vi.hoisted(() => {
  const connect = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const handleRequest = vi.fn(async () => new Response("ok"));
  const MockSdkMcpServer = vi.fn(
    class MockSdkMcpServer {
      connect = connect;
      close = close;
    },
  );
  const MockTransport = vi.fn(
    class MockTransport {
      handleRequest = handleRequest;
    },
  );
  return {
    connect,
    close,
    handleRequest,
    MockSdkMcpServer,
    MockTransport,
  };
});

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: mocks.MockSdkMcpServer,
}));

vi.mock(
  "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js",
  () => ({
    WebStandardStreamableHTTPServerTransport: mocks.MockTransport,
  }),
);

beforeEach(() => {
  mocks.connect.mockClear();
  mocks.close.mockClear();
  mocks.handleRequest.mockReset();
  mocks.handleRequest.mockImplementation(async () => new Response("ok"));
  mocks.MockSdkMcpServer.mockClear();
  mocks.MockTransport.mockClear();
});

function mockServe() {
  const stop = vi.fn(async () => {});
  let fetch: ((request: Request) => Response | Promise<Response>) | undefined;
  vi.spyOn(Bun, "serve").mockImplementation(((options: {
    readonly fetch: typeof fetch;
  }) => {
    fetch = options.fetch;
    return {
      hostname: "127.0.0.1",
      port: 3001,
      stop,
    };
  }) as never);
  return {
    stop,
    fetch(request: Request) {
      if (!fetch) throw new Error("fetch handler is not set");
      return fetch(request);
    },
  };
}

function mockShutdown() {
  return {
    trigger: vi.fn(),
  };
}

test("uses package name and version", async () => {
  const server = mockServe();
  const { McpServer: SdkMcpServer } = await import(
    "@modelcontextprotocol/sdk/server/mcp.js"
  );

  await McpServer.create(mockShutdown() as never);
  await server.fetch(new Request("http://127.0.0.1/mcp", { method: "POST" }));

  expect(SdkMcpServer).toHaveBeenCalledWith({
    name: pkg.name,
    version: pkg.version,
  });
});

test("connects SDK server to transport", async () => {
  mockServe();

  await McpServer.create(mockShutdown() as never);

  expect(mocks.MockSdkMcpServer).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("creates a fresh SDK server and transport for each request", async () => {
  const server = mockServe();
  await McpServer.create(mockShutdown() as never);
  const request = new Request("http://127.0.0.1/mcp", { method: "POST" });

  await server.fetch(request);
  await server.fetch(request);

  expect(mocks.MockSdkMcpServer).toHaveBeenCalledTimes(2);
  expect(mocks.MockTransport).toHaveBeenCalledTimes(2);
  expect(mocks.connect).toHaveBeenCalledTimes(2);
  expect(mocks.connect).toHaveBeenCalledWith(
    expect.objectContaining({ handleRequest: mocks.handleRequest }),
  );
});

test("exposes mcp url", async () => {
  mockServe();

  const mcpServer = await McpServer.create(mockShutdown() as never);

  expect(mcpServer.url).toBe("http://127.0.0.1:3001/mcp");
});

test("logs start and ready", async () => {
  mockServe();

  await McpServer.create(mockShutdown() as never);

  expect(logger.debug).toHaveBeenCalledWith("MCP server is starting…");
  expect(logger.info).toHaveBeenCalledWith("MCP server is ready", {
    url: "http://127.0.0.1:3001/mcp",
  });
});

test("returns 404 outside mcp path", async () => {
  const server = mockServe();
  const mcpServer = await McpServer.create(mockShutdown() as never);

  const response = await server.fetch(new Request("http://127.0.0.1/other"));

  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Not Found");
  expect(mocks.handleRequest).not.toHaveBeenCalled();
  await mcpServer[Symbol.asyncDispose]();
});

test("forwards mcp requests to transport", async () => {
  const server = mockServe();
  const mcpServer = await McpServer.create(mockShutdown() as never);
  const request = new Request("http://127.0.0.1/mcp", { method: "POST" });

  const response = await server.fetch(request);

  expect(response.status).toBe(200);
  expect(await response.text()).toBe("ok");
  expect(mocks.handleRequest).toHaveBeenCalledWith(request);
  await mcpServer[Symbol.asyncDispose]();
});

test("returns 500 when transport handling fails", async () => {
  const server = mockServe();
  mocks.handleRequest.mockRejectedValueOnce(new Error("boom"));
  const mcpServer = await McpServer.create(mockShutdown() as never);

  const response = await server.fetch(new Request("http://127.0.0.1/mcp"));

  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Internal Server Error");
  expect(logger.error).toHaveBeenCalledWith(
    "Failed to handle MCP request",
    expect.any(Error),
  );
  expect(mocks.close).toHaveBeenCalledOnce();
  await mcpServer[Symbol.asyncDispose]();
});

test("stops Bun server on dispose", async () => {
  const { stop } = mockServe();
  const mcpServer = await McpServer.create(mockShutdown() as never);

  await mcpServer[Symbol.asyncDispose]();

  expect(stop).toHaveBeenCalledWith(true);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledWith("MCP server is stopped");
});

test("dispose is idempotent", async () => {
  const { stop } = mockServe();
  const mcpServer = await McpServer.create(mockShutdown() as never);

  await mcpServer[Symbol.asyncDispose]();
  await mcpServer[Symbol.asyncDispose]();

  expect(stop).toHaveBeenCalledOnce();
  expect(mocks.close).not.toHaveBeenCalled();
});

test("dispose logs fatal and triggers shutdown when Bun server stop fails", async () => {
  const error = new Error("stop failed");
  const shutdown = mockShutdown();
  const { stop } = mockServe();
  stop.mockRejectedValueOnce(error);
  const mcpServer = await McpServer.create(shutdown as never);

  await expect(mcpServer[Symbol.asyncDispose]()).resolves.toBeUndefined();
  expect(stop).toHaveBeenCalledWith(true);
  expect(logger.fatal).toHaveBeenCalledWith("Failed to stop MCP server", error);
  expect(shutdown.trigger).toHaveBeenCalledOnce();
});
