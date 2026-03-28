import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
import pkg from "~/package.json" with { type: "json" };

function mockOpencodeClient(
  status:
    | { readonly status: "connected" }
    | { readonly status: "failed"; readonly error: string }
    | { readonly status: "needs_auth" } = {
    status: "connected",
  },
) {
  const add = vi.fn(async () => ({
    data: {
      [pkg.name]: status,
    },
  }));

  return {
    add,
    client: {
      mcp: {
        add,
      },
    },
  };
}

function createClientTransport(url: string): Transport {
  const transport = new StreamableHTTPClientTransport(new URL(url));

  const wrapper: Transport = {
    start() {
      return transport.start();
    },
    send(message: JSONRPCMessage, options?: TransportSendOptions) {
      return transport.send(message, options);
    },
    close() {
      return transport.close();
    },
    setProtocolVersion(version) {
      transport.setProtocolVersion(version);
    },
  };

  Object.defineProperties(wrapper, {
    onclose: {
      get() {
        return transport.onclose;
      },
      set(value: Transport["onclose"]) {
        if (value) {
          transport.onclose = value;
          return;
        }
        Reflect.deleteProperty(transport, "onclose");
      },
    },
    onerror: {
      get() {
        return transport.onerror;
      },
      set(value: Transport["onerror"]) {
        if (value) {
          transport.onerror = value;
          return;
        }
        Reflect.deleteProperty(transport, "onerror");
      },
    },
    onmessage: {
      get() {
        return transport.onmessage;
      },
      set(value: Transport["onmessage"]) {
        if (value) {
          transport.onmessage = value;
          return;
        }
        Reflect.deleteProperty(transport, "onmessage");
      },
    },
    sessionId: {
      get() {
        return transport.sessionId;
      },
    },
  });

  return wrapper;
}

test("registers with OpenCode using a remote MCP config", async () => {
  const { add, client } = mockOpencodeClient();

  await using mcpServer = await McpServer.create({} as never, client as never);

  expect(add).toHaveBeenCalledWith(
    {
      name: pkg.name,
      config: {
        type: "remote",
        url: mcpServer.url,
        enabled: true,
      },
    },
    { throwOnError: true },
  );
  expect(mcpServer.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  expect(logger.info).toHaveBeenCalledWith("MCP server is ready", {
    url: mcpServer.url,
  });
});

test("resolves closed when disposed", async () => {
  const { client } = mockOpencodeClient();
  const mcpServer = await McpServer.create({} as never, client as never);

  const closed = mcpServer.closed;

  await mcpServer[Symbol.asyncDispose]();

  await expect(closed).resolves.toBeUndefined();
  expect(logger.info).toHaveBeenCalledWith("MCP server is stopped");
});

test("dispose is idempotent", async () => {
  const { client } = mockOpencodeClient();
  const mcpServer = await McpServer.create({} as never, client as never);

  await mcpServer[Symbol.asyncDispose]();
  await mcpServer[Symbol.asyncDispose]();

  expect(logger.info).toHaveBeenCalledTimes(3);
});

test("serves health checks", async () => {
  const { client } = mockOpencodeClient();

  await using mcpServer = await McpServer.create({} as never, client as never);

  const response = await fetch(new URL("/health", mcpServer.url));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("returns not found for unknown paths", async () => {
  const { client } = mockOpencodeClient();

  await using mcpServer = await McpServer.create({} as never, client as never);

  const response = await fetch(new URL("/missing", mcpServer.url));

  expect(response.status).toBe(404);
  expect(await response.text()).toBe("Not Found");
});

test("returns a JSON-RPC error when MCP request handling throws", async () => {
  const { client } = mockOpencodeClient();
  vi.spyOn(
    WebStandardStreamableHTTPServerTransport.prototype,
    "handleRequest",
  ).mockRejectedValueOnce(new Error("boom"));

  await using mcpServer = await McpServer.create({} as never, client as never);

  const response = await fetch(mcpServer.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message: "Internal server error",
    },
    id: null,
  });
  expect(logger.error).toHaveBeenCalledWith(
    "MCP request failed",
    expect.any(Error),
    {
      method: "POST",
      url: mcpServer.url,
    },
  );
});

test("supports concurrent stateless clients", async () => {
  const { client } = mockOpencodeClient();

  await using mcpServer = await McpServer.create({} as never, client as never);

  await Promise.all(
    Array.from({ length: 3 }, async (_, index) => {
      const transport = createClientTransport(mcpServer.url);
      const client = new Client({
        name: `test-client-${index}`,
        version: "1.0.0",
      });

      await client.connect(transport);
      expect(client.getServerVersion()).toEqual({
        name: pkg.name,
        version: pkg.version,
      });
      await expect(client.ping()).resolves.toEqual({});
      await transport.close();
    }),
  );
});

test("stops the Bun server when OpenCode cannot connect to it", async () => {
  const { client } = mockOpencodeClient({
    status: "failed",
    error: "boom",
  });

  await expect(McpServer.create({} as never, client as never)).rejects.toThrow(
    `OpenCode failed to connect MCP server "${pkg.name}" (failed): boom`,
  );
  expect(logger.info).toHaveBeenCalledWith("MCP server is stopped");
});

test("throws when OpenCode returns a non-connected status without an error", async () => {
  const { client } = mockOpencodeClient({
    status: "needs_auth",
  });

  await expect(McpServer.create({} as never, client as never)).rejects.toThrow(
    `OpenCode failed to connect MCP server "${pkg.name}"`,
  );
});

test("reuses cleanup work", async () => {
  let cleaned = 0;
  const cleanup = McpServer.createCleanup(async () => {
    cleaned++;
  });

  await Promise.all([cleanup(), cleanup()]);

  expect(cleaned).toBe(1);
});

test("cleans up bodyless responses", async () => {
  let cleaned = 0;
  const response = McpServer.withCleanup(new Response(null), async () => {
    cleaned++;
  });

  expect(await response.text()).toBe("");
  expect(cleaned).toBe(1);
});

test("cleans up cancelled response streams", async () => {
  let cleaned = 0;
  const response = McpServer.withCleanup(
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("hello"));
        },
      }),
    ),
    async () => {
      cleaned++;
    },
  );

  const reader = response.body?.getReader();
  expect(reader).toBeDefined();
  await reader?.cancel();
  expect(cleaned).toBe(1);
});
