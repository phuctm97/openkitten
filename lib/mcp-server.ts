import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import { logger } from "~/lib/logger";
import pkg from "~/package.json" with { type: "json" };

export class McpServer implements AsyncDisposable {
  readonly #bot: Bot;
  readonly #opencodeClient: OpencodeClient;
  readonly #closed: Promise<void>;
  readonly #dispose: () => Promise<void>;
  readonly #url: string;

  private constructor(
    bot: Bot,
    opencodeClient: OpencodeClient,
    closed: Promise<void>,
    dispose: () => Promise<void>,
    url: string,
  ) {
    this.#bot = bot;
    this.#opencodeClient = opencodeClient;
    this.#closed = closed;
    this.#dispose = dispose;
    this.#url = url;
  }

  get closed(): Promise<void> {
    // Bun.serve runs in-process and does not expose an independent unexpected
    // close signal, so this only resolves when the wrapper is explicitly
    // disposed.
    return this.#closed;
  }

  get url(): string {
    return this.#url;
  }

  async #handleRequest(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === McpServer.healthPath) {
      return Response.json({ status: "ok" });
    }

    if (pathname !== McpServer.endpointPath) {
      return new Response("Not Found", { status: 404 });
    }

    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = this.#createRequestServer();
    const cleanup = McpServer.createCleanup(() =>
      Promise.allSettled([transport.close(), server.close()]).then(() => {}),
    );

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      return McpServer.withCleanup(response, cleanup);
    } catch (error) {
      await cleanup();
      logger.error("MCP request failed", error, {
        method: request.method,
        url: request.url,
      });
      return McpServer.createInternalErrorResponse();
    }
  }

  #createRequestServer(): SdkMcpServer {
    return new SdkMcpServer(
      {
        name: McpServer.serverName,
        version: pkg.version,
      },
      {
        instructions: [
          "OpenKitten MCP server.",
          `grammY bot attached: ${String(Boolean(this.#bot))}.`,
          `OpenCode client attached: ${String(Boolean(this.#opencodeClient))}.`,
        ].join(" "),
      },
    );
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

    const { promise: closed, resolve } = Promise.withResolvers<void>();

    let disposePromise: Promise<void> | undefined;
    let mcpServer: McpServer;

    const server = Bun.serve({
      hostname: McpServer.hostname,
      port: 0,
      fetch(request) {
        return mcpServer.#handleRequest(request);
      },
    });

    const url = new URL(McpServer.endpointPath, server.url).href;

    mcpServer = new McpServer(
      bot,
      opencodeClient,
      closed,
      async () => {
        disposePromise ??= (async () => {
          await server.stop(true);
          resolve();
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

  static createCleanup(cleanup: () => Promise<void>): () => Promise<void> {
    let promise: Promise<void> | undefined;
    return async () => {
      promise ??= cleanup();
      await promise;
    };
  }

  static createInternalErrorResponse(): Response {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      },
      { status: 500 },
    );
  }

  static withCleanup(
    response: Response,
    cleanup: () => Promise<void>,
  ): Response {
    const body =
      response.body ??
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
    const reader = body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            await cleanup();
            return;
          }
          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
          await cleanup();
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          await cleanup();
        }
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
}
