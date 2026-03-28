import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";
import pkg from "~/package.json" with { type: "json" };

function createSdkMcpServer(): SdkMcpServer {
  return new SdkMcpServer({
    name: pkg.name,
    version: pkg.version,
  });
}

export class McpServer implements AsyncDisposable {
  readonly #url: string;
  readonly #dispose: () => Promise<void>;

  private constructor(url: string, dispose: () => Promise<void>) {
    this.#url = url;
    this.#dispose = dispose;
  }

  get url(): string {
    return this.#url;
  }

  async [Symbol.asyncDispose]() {
    await this.#dispose();
  }

  static async create(shutdown: Shutdown): Promise<McpServer> {
    logger.debug("MCP server is starting…");

    const bunServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        if (new URL(request.url).pathname !== "/mcp") {
          return new Response("Not Found", { status: 404 });
        }
        // Stateless MCP transports must be fresh per request.
        const transport = new WebStandardStreamableHTTPServerTransport();
        const sdkMcpServer = createSdkMcpServer();
        try {
          await sdkMcpServer.connect(transport);
          return await transport.handleRequest(request);
        } catch (error) {
          logger.error("Failed to handle MCP request", error);
          try {
            await sdkMcpServer.close();
          } catch (closeError) {
            logger.error("Failed to clean up MCP request", closeError);
          }
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    });

    const url = `http://${bunServer.hostname}:${bunServer.port}/mcp`;
    logger.info("MCP server is ready", { url });

    let disposed = false;
    return new McpServer(url, async () => {
      if (disposed) return;
      disposed = true;
      try {
        await bunServer.stop(true);
        logger.info("MCP server is stopped");
      } catch (error) {
        logger.fatal("Failed to stop MCP server", error);
        shutdown.trigger();
      }
    });
  }
}
