import { randomBytes } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OpenkittenAPI } from "@openkitten/plugin";
import type { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import zod from "zod";
import type { Database } from "~/lib/database";
import { logger } from "~/lib/logger";
import type { Profile } from "~/lib/profile";

const rpcSchema = zod.object({
  method: zod.string().min(1),
  args: zod.array(zod.unknown()),
});

class OpenkittenAPIImpl implements OpenkittenAPI {
  readonly #bot: Bot;
  readonly #database: Database;
  #botInfoPromise: Promise<UserFromGetMe> | undefined;

  constructor(bot: Bot, database: Database) {
    this.#bot = bot;
    this.#database = database;
  }

  async getBotInfo(): Promise<OpenkittenAPI.BotInfo> {
    this.#botInfoPromise ??= this.#bot.api.getMe();
    const me = await this.#botInfoPromise;
    return {
      id: me.id,
      isBot: me.is_bot,
      firstName: me.first_name,
      username: me.username,
    };
  }

  async listSessions(): Promise<OpenkittenAPI.SessionInfo[]> {
    const rows = this.#database.query.session
      .findMany({
        columns: {
          id: true,
          chatId: true,
          threadId: true,
          agent: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .sync();
    return rows.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      threadId: row.threadId || undefined,
      agent: row.agent,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}

export class PluginAPI implements Disposable {
  readonly #token: string;
  readonly #server: Bun.Server<undefined>;
  readonly #configPath: string;
  readonly #handlers: ReadonlyMap<string, (...args: never) => unknown>;

  private constructor(bot: Bot, database: Database, configPath: string) {
    const impl = new OpenkittenAPIImpl(bot, database);
    this.#token = randomBytes(32).toString("base64url");
    this.#configPath = configPath;

    const proto = Object.getPrototypeOf(impl);
    const handlers = new Map<string, (...args: never) => unknown>();
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (descriptor && typeof descriptor.value === "function") {
        handlers.set(name, descriptor.value.bind(impl));
      }
    }
    this.#handlers = handlers;

    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => this.#fetch(req),
    });
  }

  async #fetch(req: Request): Promise<Response> {
    if (req.headers.get("authorization") !== `Bearer ${this.#token}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (req.method !== "POST") {
      return Response.json({ error: "Method Not Allowed" }, { status: 405 });
    }
    try {
      const body = rpcSchema.parse(await req.json());
      const handler = this.#handlers.get(body.method);
      if (!handler) {
        return Response.json(
          { error: `Unknown method: ${body.method}` },
          { status: 404 },
        );
      }
      const result: unknown = await Reflect.apply(
        handler,
        undefined,
        body.args,
      );
      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      if (error instanceof zod.ZodError) {
        return Response.json(
          { error: error.issues.map((i) => i.message).join(", ") },
          { status: 400 },
        );
      }
      logger.error("Plugin API request failed", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Internal error" },
        { status: 500 },
      );
    }
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    unlink(this.#configPath).catch((error) => {
      logger.warn("Failed to delete plugin API config", error);
    });
    logger.info("Plugin API is terminated");
  }

  static async create(
    profile: Profile,
    bot: Bot,
    database: Database,
  ): Promise<PluginAPI> {
    const configPath = join(profile.xdgState, "openkitten", "plugin-api.json");
    const pluginAPI = new PluginAPI(bot, database, configPath);
    await mkdir(dirname(configPath), { recursive: true });
    await Bun.write(
      configPath,
      JSON.stringify({
        url: pluginAPI.#server.url.href.replace(/\/$/, ""),
        token: pluginAPI.#token,
      }),
    );
    logger.info("Plugin API is ready");
    return pluginAPI;
  }
}
