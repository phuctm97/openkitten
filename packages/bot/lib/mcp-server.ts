import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import zod from "zod";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyCreateTelegramAttachment } from "~/lib/grammy-create-telegram-attachment";
import { logger } from "~/lib/logger";
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
    path: zod.string().trim().min(1).optional(),
    url: zod.string().trim().url().optional(),
    filename: zod.string().trim().min(1).optional(),
    mimeType: zod.string().trim().min(1).optional(),
    __OPENKITTEN__: openkittenMetadataSchema
      .optional()
      .describe("Internal metadata injected by OpenKitten."),
  })
  .refine(
    ({ path, url }) => Number(!!path) + Number(!!url) === 1,
    "Provide exactly one of path or url.",
  );

const sendFileOutputSchema = zod.object({
  filename: zod.string(),
  kind: zod.enum(attachmentKinds),
  source: zod.enum(["path", "url"]),
});

type OpenkittenMetadata = zod.output<typeof openkittenMetadataSchema>;
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
        description:
          "Send a local file path or URL back to the Telegram chat for the current OpenKitten session. The file is routed to the best Telegram method automatically.",
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
    const metadata = this.#openkittenMetadata(args.__OPENKITTEN__);
    const source = await this.#sendFileSource(args);
    const location = this.#existingSessions.get(metadata.sessionID);
    if (!location) {
      throw new Error(`No Telegram session found: ${metadata.sessionID}`);
    }

    const attachment = grammyCreateTelegramAttachment({
      bytes: source.bytes,
      fallbackName: "attachment",
      filename: source.filename,
      mimeType: source.mimeType,
    });
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

    logger.info("MCP file is sent to Telegram", {
      callId: metadata.callID,
      chatId: location.chatId,
      filename: attachment.filename,
      kind: attachment.kind,
      sessionId: metadata.sessionID,
      source: source.source,
      threadId: location.threadId,
    });

    const output = {
      filename: attachment.filename,
      kind: attachment.kind,
      source: source.source,
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

  async #sendFileSource(args: SendFileArgs): Promise<{
    readonly bytes: Uint8Array;
    readonly filename: string | undefined;
    readonly mimeType: string | undefined;
    readonly source: "path" | "url";
  }> {
    if (args.path) return this.#loadLocalFile(args);
    return this.#loadRemoteFile(args);
  }

  async #loadLocalFile(args: SendFileArgs): Promise<{
    readonly bytes: Uint8Array;
    readonly filename: string | undefined;
    readonly mimeType: string | undefined;
    readonly source: "path";
  }> {
    const path = args.path;
    if (!path) {
      throw new Error("send_file requires a local path.");
    }

    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      bytes: await file.bytes(),
      filename: cleanText(args.filename) ?? cleanText(basename(path)),
      mimeType: cleanMimeType(args.mimeType) ?? cleanMimeType(file.type),
      source: "path",
    };
  }

  async #loadRemoteFile(args: SendFileArgs): Promise<{
    readonly bytes: Uint8Array;
    readonly filename: string | undefined;
    readonly mimeType: string | undefined;
    readonly source: "url";
  }> {
    const url = args.url;
    if (!url) {
      throw new Error("send_file requires a URL.");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
      );
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      filename: cleanText(args.filename) ?? filenameFromUrl(url),
      mimeType:
        cleanMimeType(args.mimeType) ??
        cleanMimeType(response.headers.get("content-type") ?? undefined),
      source: "url",
    };
  }

  #openkittenMetadata(rawMetadata: unknown): OpenkittenMetadata {
    const result = openkittenMetadataSchema.safeParse(rawMetadata);
    if (result.success) return result.data;
    throw new Error("OpenKitten tool metadata is missing.");
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
    opencodeClient: OpencodeClient,
    bot: Bot,
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

function filenameFromUrl(url: string): string | undefined {
  if (url.startsWith("data:")) return undefined;

  const pathname = new URL(url).pathname;
  return cleanText(basename(decodeURIComponent(pathname)));
}

function cleanMimeType(value: string | undefined): string | undefined {
  return cleanText(value)?.split(";", 1)[0]?.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
