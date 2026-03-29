import { randomBytes } from "node:crypto";
import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { logger } from "~/lib/logger";
import pkg from "~/package.json" with { type: "json" };

export class McpServer implements Disposable {
  readonly #token: string;
  readonly #server: Bun.Server<undefined>;
  readonly #disconnected: Promise<void>;
  readonly #resolve: () => void;

  private constructor() {
    this.#token = randomBytes(32).toString("base64url");
    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => this.#fetch(req),
    });
    const { resolve, promise } = Promise.withResolvers<void>();
    this.#disconnected = promise;
    this.#resolve = resolve;
  }

  async #fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }
    if (req.headers.get("authorization") !== `Bearer ${this.#token}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const server = new Server({
      name: pkg.name,
      version: pkg.version,
      title: "OpenKitten",
      description:
        "Additional tools and resources for OpenKitten-powered agents",
      websiteUrl: "https://openkitten.com",
    });
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  get disconnected(): Promise<void> {
    return this.#disconnected;
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    this.#resolve();
    logger.info("MCP server is disconnected");
  }

  static async create(opencodeClient: OpencodeClient): Promise<McpServer> {
    logger.debug("MCP server is connecting…");
    const server = new McpServer();
    const url = new URL("/mcp", server.#server.url).href;
    try {
      await opencodeClient.mcp.add(
        {
          name: pkg.name,
          config: {
            type: "remote",
            url,
            headers: { authorization: `Bearer ${server.#token}` },
          },
        },
        { throwOnError: true },
      );
      logger.info("MCP server is connected", { url });
    } catch (error) {
      server[Symbol.dispose]();
      throw error;
    }
    return server;
  }
}
