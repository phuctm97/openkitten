import { consola } from "consola";
import { Bot as Client } from "grammy";
import type { Bot } from "~/lib/bot";

export async function createBot(): Promise<Bot> {
  const token = Bun.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

  const client = new Client(token);

  // Fatal: errors should never reach here — all event handlers will have
  // their own error boundaries.
  client.catch((error) => {
    consola.fatal("bot caught an error", error);
  });

  const { resolve, promise: started } = Promise.withResolvers<void>();
  const polling = client.start({ onStart: () => resolve() });

  // client.start() rejects if polling fails before onStart fires.
  await Promise.race([started, polling]);

  // Only reject if polling stops on its own, not when we stop it.
  let disposed = false;
  const stopped = polling.then(() => {
    if (disposed) return;
    throw new Error("bot stopped unexpectedly");
  });

  // stopped rejects on unexpected stop but may not be awaited immediately by
  // the consumer. Without this handler, the rejection would be unhandled.
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
      // Resolve started and await all promises to ensure no stuck promises.
      resolve();
      await Promise.all([started, stopped]);
    },
  };
}
