import { consola } from "consola";
import { Bot as Client } from "grammy";
import type { Bot } from "~/lib/bot";

export async function createBot(): Promise<Bot> {
  const token = Bun.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

  const client = new Client(token);

  const ready = Promise.withResolvers<void>();
  const stopped = client.start({ onStart: () => ready.resolve() });

  // client.start() rejects if polling fails before onStart fires.
  await Promise.race([ready.promise, stopped]);

  // Prevent unhandled rejection if polling errors between startup and dispose.
  const settled = stopped.then(
    () => {},
    () => {},
  );

  consola.ready("bot is ready");

  return {
    client,
    [Symbol.asyncDispose]: async () => {
      await client.stop();
      consola.debug("bot is stopped");
      ready.resolve();
      await Promise.all([ready.promise, settled]);
    },
  };
}
