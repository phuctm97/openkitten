import { consola } from "consola";
import { Bot } from "grammy";
import type { Grammy } from "~/lib/grammy";

export async function createGrammy(): Promise<Grammy> {
  const token = Bun.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

  const bot = new Bot(token);

  // Fatal: errors should never reach here — all event handlers will have
  // their own error boundaries.
  bot.catch((error) => {
    consola.fatal("grammy caught an error", error);
  });

  const { resolve, promise: started } = Promise.withResolvers<void>();
  const polling = bot.start({ onStart: () => resolve() });

  // bot.start() rejects if polling fails before onStart fires.
  await Promise.race([started, polling]);

  // Only reject if polling stops on its own, not when we stop it.
  let disposed = false;
  const stopped = polling.then(() => {
    if (disposed) return;
    throw new Error("grammy stopped unexpectedly");
  });

  // stopped rejects on unexpected stop but may not be awaited immediately by
  // the consumer. Without this handler, the rejection would be unhandled.
  stopped.then(
    () => {},
    () => {},
  );

  consola.ready("grammy is ready");

  return {
    stopped,
    bot,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      await bot.stop();
      consola.debug("grammy is stopped");
      resolve();
      await Promise.all([started, stopped]);
    },
  };
}
