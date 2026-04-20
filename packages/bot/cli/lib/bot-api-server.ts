import { randomBytes } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { contract } from "@openkitten/api";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { logger } from "~/lib/logger";
import type { Profile } from "~/lib/profile";

export class BotAPIServer implements Disposable {
  readonly #server: Bun.Server<undefined>;
  readonly #configPath: string;

  private constructor(botToken: string, authToken: string, configPath: string) {
    const os = implement(contract);
    const router = os.router({
      getBotToken: os.getBotToken.handler(async () => botToken),
    });
    const rpcHandler = new RPCHandler(router);

    this.#configPath = configPath;
    this.#server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (req) => {
        if (req.headers.get("authorization") !== `Bearer ${authToken}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { matched, response } = await rpcHandler.handle(req, {
          prefix: "/rpc",
        });
        if (matched) return response;
        return new Response("Not found", { status: 404 });
      },
    });
  }

  [Symbol.dispose]() {
    this.#server[Symbol.dispose]();
    unlink(this.#configPath).catch((error) => {
      logger.warn("Failed to delete bot API config", error);
    });
    logger.info("Bot API server is terminated");
  }

  static async create(
    profile: Profile,
    botToken: string,
  ): Promise<BotAPIServer> {
    const configPath = join(profile.xdgState, "openkitten", "bot-api.json");
    const authToken = randomBytes(32).toString("base64url");
    const server = new BotAPIServer(botToken, authToken, configPath);
    await mkdir(dirname(configPath), { recursive: true });
    await Bun.write(
      configPath,
      JSON.stringify({
        url: `${server.#server.url.href.replace(/\/$/, "")}/rpc`,
        token: authToken,
      }),
    );
    logger.info("Bot API server is ready");
    return server;
  }
}
