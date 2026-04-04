import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { type Bot, InputFile } from "grammy";
import { extension as mimeExtension, lookup as mimeLookup } from "mime-types";
import zod from "zod";
import type { ExistingSessions } from "~/lib/existing-sessions";
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
    path: zod.string().trim().min(1),
    caption: zod.string().trim().min(1).optional(),
  })
  .passthrough();

const sendFileOutputSchema = zod.object({
  filename: zod.string(),
  kind: zod.enum(attachmentKinds),
});

type OpenkittenMetadata = zod.output<typeof openkittenMetadataSchema>;
type SendFileArgs = zod.output<typeof sendFileInputSchema>;
type SendFileOutput = zod.output<typeof sendFileOutputSchema>;
type AttachmentKind = (typeof attachmentKinds)[number];

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
          "Send a local file back to the Telegram chat for the current OpenKitten session. The Telegram method is chosen from the file path.",
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
    const metadata = this.#openkittenMetadata(args);
    const source = await this.#loadLocalFile(args);
    const location = this.#existingSessions.get(metadata.sessionID);
    if (!location) {
      throw new Error(`No Telegram session found: ${metadata.sessionID}`);
    }

    const caption = cleanText(args.caption);
    const filename = attachmentFilename(
      source.filename,
      undefined,
      "attachment",
    );
    const attachment = {
      filename,
      kind: attachmentKind(undefined, filename),
      media: new InputFile(source.bytes, filename),
    };
    const sendOptions = {
      ...(location.threadId && { message_thread_id: location.threadId }),
    };
    const captionedSendOptions = {
      ...sendOptions,
      ...(caption && { caption }),
    };

    switch (attachment.kind) {
      case "animation":
        await this.#bot.api.sendAnimation(
          location.chatId,
          attachment.media,
          captionedSendOptions,
        );
        break;
      case "audio":
        await this.#bot.api.sendAudio(
          location.chatId,
          attachment.media,
          captionedSendOptions,
        );
        break;
      case "document":
        await this.#bot.api.sendDocument(
          location.chatId,
          attachment.media,
          captionedSendOptions,
        );
        break;
      case "photo":
        await this.#bot.api.sendPhoto(
          location.chatId,
          attachment.media,
          captionedSendOptions,
        );
        break;
      case "sticker":
        await this.#bot.api.sendSticker(
          location.chatId,
          attachment.media,
          sendOptions,
        );
        if (caption) {
          await this.#bot.api.sendMessage(
            location.chatId,
            caption,
            sendOptions,
          );
        }
        break;
      case "video":
        await this.#bot.api.sendVideo(
          location.chatId,
          attachment.media,
          captionedSendOptions,
        );
        break;
    }

    logger.info("MCP file is sent to Telegram", {
      callId: metadata.callID,
      caption,
      chatId: location.chatId,
      filename: attachment.filename,
      kind: attachment.kind,
      sessionId: metadata.sessionID,
      threadId: location.threadId,
    });

    const output = {
      filename: attachment.filename,
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

  async #loadLocalFile(args: SendFileArgs): Promise<{
    readonly bytes: Uint8Array;
    readonly filename: string;
  }> {
    const path = args.path;

    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      bytes: await file.bytes(),
      filename: basename(path),
    };
  }

  #openkittenMetadata(rawArgs: unknown): OpenkittenMetadata {
    if (!isRecord(rawArgs)) {
      throw new Error("OpenKitten tool metadata is missing.");
    }
    const result = openkittenMetadataSchema.safeParse(
      rawArgs["__OPENKITTEN__"],
    );
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

function cleanMimeType(value: string | undefined): string | undefined {
  return cleanText(value)?.split(";", 1)[0]?.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function attachmentFilename(
  filename: string | undefined,
  mimeType: string | undefined,
  fallbackName: string,
): string {
  const name = cleanText(filename);
  const ext = mimeExtension(cleanMimeType(mimeType) ?? "");
  if (name) return fileExtension(name) || !ext ? name : `${name}.${ext}`;

  return ext ? `${fallbackName}.${ext}` : fallbackName;
}

function attachmentKind(
  mimeType: string | undefined,
  filename: string,
): AttachmentKind {
  const mime = attachmentMimeType(mimeType, filename);
  const ext = fileExtension(filename);

  if (mime === "application/x-tgsticker" || ext === "tgs") return "sticker";

  if (mime === "image/gif" || ext === "gif") return "animation";

  if (mime === "image/svg+xml" || ext === "svg") return "document";

  if (mime?.startsWith("image/")) return "photo";

  if (mime?.startsWith("video/")) return "video";

  if (mime?.startsWith("audio/")) return "audio";

  return "document";
}

function attachmentMimeType(
  mimeType: string | undefined,
  filename: string,
): string | undefined {
  const cleanedMime = cleanMimeType(mimeType);
  if (cleanedMime && cleanedMime !== "application/octet-stream") {
    return cleanedMime;
  }

  const filenameMime = mimeLookup(filename);
  if (typeof filenameMime === "string") return filenameMime.toLowerCase();

  return cleanedMime;
}

function fileExtension(filename: string): string | undefined {
  const index = filename.lastIndexOf(".");
  if (index < 0 || index === filename.length - 1) return undefined;
  return filename.slice(index + 1).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
