import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "~/lib/logger";
import pkg from "~/package.json" with { type: "json" };

export class McpServer implements Disposable {
  readonly #server: Bun.Server<undefined>;
  readonly #stopped: Promise<void>;
  readonly #resolve: () => void;

  private constructor() {
    logger.debug("MCP server is starting…");
    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => this.#fetch(req),
    });
    logger.info("MCP server is ready", { url: this.#server.url.href });
    const { resolve, promise } = Promise.withResolvers<void>();
    this.#stopped = promise;
    this.#resolve = resolve;
  }

  async #fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }
    const server = new Server({
      name: pkg.name,
      version: pkg.version,
      title: "OpenKitten",
      description: "MCP server for OpenKitten-powered agents",
      websiteUrl: "https://openkitten.com",
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
    return new McpServer();
  }
}
