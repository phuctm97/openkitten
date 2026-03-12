import { consola } from "consola";
import { Bot as Client } from "grammy";
import type { Bot } from "~/lib/bot";

export async function createBot(): Promise<Bot> {
  const token = Bun.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

  const client = new Client(token);

  const ready = Promise.withResolvers<void>();
  const polling = client.start({ onStart: () => ready.resolve() });

  // client.start() rejects if polling fails before onStart fires.
  await Promise.race([ready.promise, polling]);

  // Only reject if polling stops on its own, not when we stop it.
  let disposed = false;
  const stopped = polling.then(() => {
    if (disposed) return;
    throw new Error("bot stopped unexpectedly");
  });

  stopped.then(
    () => {},
    () => {},
  );

  consola.ready("bot is ready");

  return {
    stopped,
    client,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      await client.stop();
      consola.debug("bot is stopped");
      ready.resolve();
      await Promise.all([ready.promise, stopped]);
    },
  };
}
