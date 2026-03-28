import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "~/lib/logger";
import pkg from "~/package.json" with { type: "json" };

export class McpServer implements Disposable {
  readonly #server: Bun.Server<undefined>;
  readonly #stopped: Promise<void>;
  readonly #resolve: () => void;

  private constructor() {
    const { resolve, promise } = Promise.withResolvers<void>();
    this.#stopped = promise;
    this.#resolve = resolve;
    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => this.#fetch(req),
    });
  }

  async #fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }
    const server = new SdkMcpServer({
      name: pkg.name,
      version: pkg.version,
    });
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  get stopped(): Promise<void> {
    return this.#stopped;
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    this.#resolve();
  }

  static create(): McpServer {
    logger.debug("MCP server is starting…");
    const mcpServer = new McpServer();
    logger.info("MCP server is ready", { url: mcpServer.#server.url.href });
    return mcpServer;
  }
}
