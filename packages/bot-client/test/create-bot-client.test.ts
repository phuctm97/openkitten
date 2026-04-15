import { contract } from "@openkitten/bot-contract";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { afterEach, expect, test } from "vitest";
import { createBotClient } from "../lib/create-bot-client";

const BOT_TOKEN = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const AUTH_TOKEN = "test-auth-token";

const os = implement(contract);

const router = os.router({
  getBotToken: os.getBotToken.handler(async () => BOT_TOKEN),
});

const rpcHandler = new RPCHandler(router);

let server: ReturnType<typeof Bun.serve> | undefined;

function startServer(): string {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req: Request) {
      if (req.headers.get("authorization") !== `Bearer ${AUTH_TOKEN}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { matched, response } = await rpcHandler.handle(req, {
        prefix: "/rpc",
      });
      if (matched) return response;
      return new Response("Not found", { status: 404 });
    },
  });
  return `${server.url.href.replace(/\/$/, "")}/rpc`;
}

afterEach(() => {
  server?.stop(true);
  server = undefined;
});

test("getBotToken returns the bot token", async () => {
  const url = startServer();
  const client = createBotClient({ url, token: AUTH_TOKEN });
  const result = await client.getBotToken();
  expect(result).toBe(BOT_TOKEN);
});

test("sends authorization header", async () => {
  const url = startServer();
  const client = createBotClient({ url, token: "wrong-token" });
  await expect(client.getBotToken()).rejects.toThrow();
});
