import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import { Hono } from "hono";
import { logger } from "~/lib/logger";
import pkg from "~/package.json" with { type: "json" };

interface McpServerEnv {
  Variables: {
    parsedBody?: unknown;
  };
}

const mcpInternalError = {
  jsonrpc: "2.0",
  error: {
    code: -32603,
    message: "Internal server error",
  },
  id: null,
};

async function handleMcpRequest(
  bot: Bot,
  opencodeClient: OpencodeClient,
  request: Request,
  parsedBody?: unknown,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = createRequestServer(bot, opencodeClient);

  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

function createRequestServer(
  bot: Bot,
  opencodeClient: OpencodeClient,
): SdkMcpServer {
  return new SdkMcpServer(
    {
      name: pkg.name,
      version: pkg.version,
    },
    {
      instructions: [
        "OpenKitten MCP server.",
        `grammY bot attached: ${String(Boolean(bot))}.`,
        `OpenCode client attached: ${String(Boolean(opencodeClient))}.`,
      ].join(" "),
    },
  );
}

function createApp(
  bot: Bot,
  opencodeClient: OpencodeClient,
): Hono<McpServerEnv> {
  const app = new Hono<McpServerEnv>();

  app.onError((error, c) => {
    logger.error("MCP request failed", error, {
      method: c.req.method,
      url: c.req.url,
    });
    return c.json(mcpInternalError, 500);
  });

  app.notFound((c) => c.text("Not Found", 404));

  app.use(McpServer.endpointPath, async (c, next) => {
    if (c.req.method === "POST") {
      const parsedBody = await parseJson(c.req.raw);
      if (parsedBody !== undefined) c.set("parsedBody", parsedBody);
    }
    await next();
  });

  app.get(McpServer.healthPath, (c) => c.json({ status: "ok" }));
  app.all(McpServer.endpointPath, (c) =>
    handleMcpRequest(bot, opencodeClient, c.req.raw, c.get("parsedBody")),
  );

  return app;
}

export class McpServer implements AsyncDisposable {
  readonly #dispose: () => Promise<void>;
  readonly #opencodeClient: OpencodeClient;
  readonly #url: string;

  private constructor(
    opencodeClient: OpencodeClient,
    dispose: () => Promise<void>,
    url: string,
  ) {
    this.#dispose = dispose;
    this.#opencodeClient = opencodeClient;
    this.#url = url;
  }

  get url(): string {
    return this.#url;
  }

  async #registerWithOpenCode(): Promise<void> {
    logger.debug("MCP server is registering with OpenCode…");

    const { data } = await this.#opencodeClient.mcp.add(
      {
        name: McpServer.serverName,
        config: {
          type: "remote",
          url: this.#url,
          enabled: true,
        },
      },
      { throwOnError: true },
    );

    const status = data[McpServer.serverName];

    if (status?.status === "connected") return;

    const message =
      status && "error" in status
        ? `OpenCode failed to connect MCP server "${McpServer.serverName}" (${status.status}): ${status.error}`
        : `OpenCode failed to connect MCP server "${McpServer.serverName}"`;

    throw new Error(message);
  }

  async [Symbol.asyncDispose]() {
    await this.#dispose();
  }

  static readonly endpointPath = "/mcp";
  static readonly healthPath = "/health";
  static readonly hostname = "127.0.0.1";
  static readonly serverName = pkg.name;

  static async create(
    bot: Bot,
    opencodeClient: OpencodeClient,
  ): Promise<McpServer> {
    logger.debug("MCP server is starting…");

    const app = createApp(bot, opencodeClient);
    const server = Bun.serve({
      hostname: McpServer.hostname,
      port: 0,
      fetch: app.fetch,
    });
    const url = new URL(McpServer.endpointPath, server.url).href;

    let disposePromise: Promise<void> | undefined;
    const mcpServer = new McpServer(
      opencodeClient,
      async () => {
        disposePromise ??= (async () => {
          await server.stop(true);
          logger.info("MCP server is stopped");
        })();
        await disposePromise;
      },
      url,
    );

    try {
      await mcpServer.#registerWithOpenCode();
      logger.info("MCP server is ready", { url });
      return mcpServer;
    } catch (error) {
      await mcpServer[Symbol.asyncDispose]();
      throw error;
    }
  }
}

async function parseJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}
