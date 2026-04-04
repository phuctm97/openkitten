import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { type Bot, InputFile } from "grammy";
import zod from "zod";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getAttachmentKind } from "~/lib/get-attachment-kind";
import { getFileExtension } from "~/lib/get-file-extension";
import { getMimeExtension } from "~/lib/get-mime-extension";
import { logger } from "~/lib/logger";
import { trimText } from "~/lib/trim-text";
import { version } from "~/package.json" with { type: "json" };

const attachmentKinds = [
  "animation",
  "audio",
  "document",
  "photo",
  "sticker",
  "video",
] as const;

const openkittenMetadataSchema = zod.object({
  sessionID: zod.string().trim().min(1),
  callID: zod.string().trim().min(1),
});

const sendFileInputSchema = zod
  .object({
    path: zod.string().trim().min(1).describe("Absolute path to a local file."),
  })
  .passthrough();

const openkittenArgsSchema = sendFileInputSchema.extend({
  __OPENKITTEN__: openkittenMetadataSchema,
});

const sendFileOutputSchema = zod.object({
  name: zod.string(),
  kind: zod.enum(attachmentKinds),
});

type SendFileArgs = zod.output<typeof sendFileInputSchema>;
type SendFileOutput = zod.output<typeof sendFileOutputSchema>;

export class McpServer implements Disposable {
  readonly #token: string;
  readonly #server: Bun.Server<undefined>;
  readonly #bot: Bot;
  readonly #existingSessions: ExistingSessions;
  readonly #disconnected: Promise<void>;
  readonly #resolve: () => void;

  private constructor(bot: Bot, existingSessions: ExistingSessions) {
    this.#token = randomBytes(32).toString("base64url");
    this.#bot = bot;
    this.#existingSessions = existingSessions;
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
      name: "openkitten",
      version,
      title: "OpenKitten",
      description:
        "Additional tools and resources for OpenKitten-powered agents",
      websiteUrl: "https://openkitten.com",
    });
    server.registerTool(
      "send_file",
      {
        description: "Send a local file.",
        inputSchema: sendFileInputSchema,
        outputSchema: sendFileOutputSchema,
      },
      async (args) => this.#sendFile(args),
    );
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  async #sendFile(args: SendFileArgs): Promise<{
    readonly content: { readonly type: "text"; readonly text: string }[];
    readonly structuredContent: SendFileOutput;
  }> {
    const parsedArgs = openkittenArgsSchema.parse(args);
    const metadata = parsedArgs.__OPENKITTEN__;
    const path = args.path;
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${path}`);
    }
    const location = this.#existingSessions.get(metadata.sessionID);
    if (!location) {
      throw new Error(`No Telegram session found: ${metadata.sessionID}`);
    }

    const filename = attachmentFilename(
      basename(path),
      undefined,
      "attachment",
    );
    const attachment = {
      filename,
      kind: getAttachmentKind(undefined, filename),
      media: new InputFile(path, filename),
    };
    const sendOptions = {
      ...(location.threadId && { message_thread_id: location.threadId }),
    };

    switch (attachment.kind) {
      case "animation":
        await this.#bot.api.sendAnimation(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
      case "audio":
        await this.#bot.api.sendAudio(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
      case "document":
        await this.#bot.api.sendDocument(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
      case "photo":
        await this.#bot.api.sendPhoto(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
      case "sticker":
        await this.#bot.api.sendSticker(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
      case "video":
        await this.#bot.api.sendVideo(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        break;
    }

    const output = {
      name: attachment.filename,
      kind: attachment.kind,
    } satisfies SendFileOutput;

    return {
      content: [
        {
          type: "text",
          text: `Sent ${attachment.filename} as ${attachment.kind}.`,
        },
      ],
      structuredContent: output,
    };
  }

  get disconnected(): Promise<void> {
    return this.#disconnected;
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    this.#resolve();
    logger.info("MCP server is disconnected");
  }

  static async create(
    bot: Bot,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): Promise<McpServer> {
    logger.debug("MCP server is connecting…");
    const server = new McpServer(bot, existingSessions);
    const url = new URL("/mcp", server.#server.url).href;
    try {
      await opencodeClient.mcp.add(
        {
          name: "openkitten",
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

function attachmentFilename(
  filename: string | undefined,
  mimeType: string | undefined,
  fallbackName: string,
): string {
  const name = trimText(filename);
  const ext = getMimeExtension(mimeType);
  if (name) return getFileExtension(name) || !ext ? name : `${name}.${ext}`;

  return ext ? `${fallbackName}.${ext}` : fallbackName;
}
