import { consola } from "consola";
import type { Bot } from "grammy";
import type { Grammy } from "~/lib/grammy";

export async function grammyStart(bot: Bot): Promise<Grammy> {
  // Fatal: errors should never reach here — all event handlers will have
  // their own error boundaries.
  bot.catch(({ ctx, error }) => {
    const chatId = ctx.chat?.id;
    const threadId = ctx.msg?.message_thread_id || undefined;
    const updateId = ctx.update.update_id;
    consola.fatal("grammY caught an unhandled error", {
      error,
      chatId,
      threadId,
      updateId,
    });
  });

  const { resolve, promise: started } = Promise.withResolvers<void>();
  consola.start("grammY is starting…");
  const polling = bot.start({ onStart: () => resolve() });

  // bot.start() rejects if polling fails before onStart fires.
  await Promise.race([started, polling]);

  // Only reject if polling stops on its own, not when we stop it.
  let disposed = false;
  const stopped = polling.then(() => {
    consola.info("grammY is stopped");
    if (disposed) return;
    throw new Error("grammY stopped unexpectedly");
  });

  // stopped rejects on unexpected stop but may not be awaited immediately by
  // the consumer. Without this handler, the rejection would be unhandled.
  stopped.then(
    () => {},
    () => {},
  );

  consola.ready("grammY is ready");

  return {
    stopped,
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      await bot.stop();
      resolve();
      await Promise.all([started, stopped]);
    },
  };
}
