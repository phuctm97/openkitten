import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type {
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { type Bot, InputFile } from "grammy";
import zod from "zod";
import { attachmentKindSchema } from "~/lib/attachment-kind-schema";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getAttachmentKind } from "~/lib/get-attachment-kind";
import { getAttachmentName } from "~/lib/get-attachment-name";
import { logger } from "~/lib/logger";
import { registerScheduleTools } from "~/lib/register-schedule-tools";
import { reloadOpencodeConfig } from "~/lib/reload-opencode-config";
import type { Scheduler } from "~/lib/scheduler";
import { websiteURL } from "~/lib/website-url";
import { version } from "~/package.json" with { type: "json" };

const openkittenMetadataSchema = zod.object({
  sessionID: zod.string().trim().min(1),
  callID: zod.string().trim().min(1),
});

const openkittenArgsSchema = zod.object({
  __OPENKITTEN__: openkittenMetadataSchema,
});

const sendFileInputSchema = zod.looseObject({
  path: zod.string().trim().min(1).describe("Absolute path to a local file."),
});

const sendFileOutputSchema = zod.object({
  name: zod.string(),
  kind: attachmentKindSchema,
});

type OpenkittenMetadata = zod.output<typeof openkittenMetadataSchema>;

type SendFileInput = zod.output<typeof sendFileInputSchema>;

type SendFileOutput = zod.output<typeof sendFileOutputSchema>;

type SendFileResult = CallToolResult & {
  readonly content: TextContent[];
  readonly structuredContent: SendFileOutput;
};

export class McpServer implements Disposable {
  readonly #bot: Bot;
  readonly #existingSessions: ExistingSessions;
  readonly #scheduler: Scheduler;
  readonly #reloadConfigOptions:
    | Parameters<typeof reloadOpencodeConfig>[0]
    | undefined;
  readonly #token: string;
  readonly #server: Bun.Server<undefined>;
  readonly #exited: Promise<void>;
  readonly #resolveExited: () => void;

  private constructor(
    bot: Bot,
    existingSessions: ExistingSessions,
    scheduler: Scheduler,
    reloadConfigOptions: Parameters<typeof reloadOpencodeConfig>[0] | undefined,
  ) {
    this.#bot = bot;
    this.#existingSessions = existingSessions;
    this.#scheduler = scheduler;
    this.#reloadConfigOptions = reloadConfigOptions;
    this.#token = randomBytes(32).toString("base64url");
    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => this.#fetch(req),
    });
    const { resolve, promise } = Promise.withResolvers<void>();
    this.#resolveExited = resolve;
    this.#exited = promise;
  }

  async #fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }
    if (req.headers.get("authorization") !== `Bearer ${this.#token}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    // MCP requests can remain open while tools run or streams stay quiet.
    this.#server.timeout(req, 0);
    const server = new Server({
      name: "openkitten",
      version,
      title: "OpenKitten",
      description:
        "Additional tools and resources for OpenKitten-powered agents",
      websiteUrl: websiteURL,
    });
    server.registerTool(
      "send_file",
      {
        description:
          "Send a local file that YOU created or generated to the user via Telegram. NEVER use this tool to re-send files that the user already uploaded or sent to you — those files are already visible to the user in the chat.",
        inputSchema: sendFileInputSchema,
        outputSchema: sendFileOutputSchema,
      },
      async (args) => this.#sendFile(args),
    );
    if (this.#reloadConfigOptions) {
      const options = this.#reloadConfigOptions;
      server.registerTool(
        "reload_commands",
        {
          description:
            "Reload custom commands after creating, updating, or deleting .md files in the commands directory to apply changes immediately.",
          inputSchema: zod.looseObject({}),
        },
        async () => {
          await reloadOpencodeConfig(options);
          return {
            content: [{ type: "text" as const, text: "Commands reloaded." }],
          };
        },
      );
    }
    registerScheduleTools(server, {
      scheduler: this.#scheduler,
      getMetadata: (args) => this.#getMetadata(args),
    });
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  async #sendFile(args: SendFileInput): Promise<SendFileResult> {
    const metadata = this.#getMetadata(args);
    const bunFile = Bun.file(args.path);
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${args.path}`);
    }
    const location = this.#existingSessions.get(metadata.sessionID);
    if (!location) {
      throw new Error(`Session not found: ${metadata.sessionID}`);
    }

    const name = getAttachmentName(
      basename(args.path),
      undefined,
      "attachment",
    );
    const kind = getAttachmentKind(undefined, name);
    const inputFile = new InputFile(args.path, name);
    const sendOptions = {
      ...(location.threadId && { message_thread_id: location.threadId }),
    };

    switch (kind) {
      case "sticker":
        await this.#bot.api.sendSticker(
          location.chatId,
          inputFile,
          sendOptions,
        );
        break;
      case "animation":
        await this.#bot.api.sendAnimation(
          location.chatId,
          inputFile,
          sendOptions,
        );
        break;
      case "document":
        await this.#bot.api.sendDocument(
          location.chatId,
          inputFile,
          sendOptions,
        );
        break;
      case "photo":
        await this.#bot.api.sendPhoto(location.chatId, inputFile, sendOptions);
        break;
      case "video":
        await this.#bot.api.sendVideo(location.chatId, inputFile, sendOptions);
        break;
      case "audio":
        await this.#bot.api.sendAudio(location.chatId, inputFile, sendOptions);
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `Sent ${name} as ${kind}.`,
        },
      ],
      structuredContent: {
        name,
        kind,
      },
    };
  }

  #getMetadata(args: unknown): OpenkittenMetadata {
    const result = openkittenArgsSchema.safeParse(args);
    if (!result.success) {
      logger.error(
        "Failed to retrieve OpenKitten metadata from MCP input",
        result.error,
      );
      throw new Error("No valid OpenKitten metadata found in MCP input");
    }
    return result.data.__OPENKITTEN__;
  }

  get exited(): Promise<void> {
    return this.#exited;
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    logger.info("MCP server is terminated");
    this.#resolveExited();
  }

  static async create(
    bot: Bot,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
    scheduler: Scheduler,
    reloadConfigOptions?:
      | Parameters<typeof reloadOpencodeConfig>[0]
      | undefined,
  ): Promise<McpServer> {
    logger.debug("MCP server is starting…");
    const server = new McpServer(
      bot,
      existingSessions,
      scheduler,
      reloadConfigOptions,
    );
    try {
      await opencodeClient.mcp.add(
        {
          name: "openkitten",
          config: {
            type: "remote",
            url: new URL("/mcp", server.#server.url).href,
            headers: { authorization: `Bearer ${server.#token}` },
          },
        },
        { throwOnError: true },
      );
      logger.info("MCP server is ready");
    } catch (error) {
      server[Symbol.dispose]();
      throw error;
    }
    return server;
  }
}
